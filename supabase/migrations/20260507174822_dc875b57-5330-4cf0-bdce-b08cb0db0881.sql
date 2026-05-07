CREATE OR REPLACE FUNCTION public.rebaseline_chips_from_closing_snapshot(_casino_id uuid, _business_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift RECORD;
  v_chips jsonb;
  v_loc_rows int := 0;
  v_init_rows int := 0;
BEGIN
  -- Find the latest CLOSED shift whose business_date matches the day being closed.
  -- Shifts span past midnight EAT (open ~18:00, close ~02–05 EAT next morning),
  -- so the "business_date" of a shift = the EAT date of opened_at.
  SELECT s.id, s.closing_count
    INTO v_shift
    FROM public.shifts s
   WHERE s.casino_id = _casino_id
     AND s.status = 'closed'
     AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date) = _business_date
     AND s.closing_count IS NOT NULL
   ORDER BY s.closed_at DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_closing_count','business_date',_business_date);
  END IF;

  v_chips := v_shift.closing_count -> 'chips';

  IF v_chips IS NULL OR jsonb_typeof(v_chips) <> 'object' THEN
    RETURN jsonb_build_object('status','no_chips_in_closing','business_date',_business_date,'shift_id',v_shift.id);
  END IF;

  -- 1) Cashier baseline ← exact chip counts the cashier entered on close.
  -- One cash desk = one location (location_type='cashier', location_id IS NULL).
  -- We overwrite existing rows AND insert any denomination that did not yet have a row.
  WITH src AS (
    SELECT (key)::bigint AS denomination,
           (value)::bigint AS qty
    FROM jsonb_each_text(v_chips)
    WHERE value ~ '^-?[0-9]+$'
  ),
  upd AS (
    UPDATE public.chip_baseline cb
       SET expected_quantity = s.qty
      FROM src s
     WHERE cb.casino_id = _casino_id
       AND cb.location_type = 'cashier'
       AND cb.location_id IS NULL
       AND cb.denomination = s.denomination
       AND cb.expected_quantity IS DISTINCT FROM s.qty
     RETURNING 1
  )
  SELECT count(*) INTO v_loc_rows FROM upd;

  -- Insert any cashier denominations that did not exist yet
  INSERT INTO public.chip_baseline (casino_id, location_type, location_id, denomination, expected_quantity)
  SELECT _casino_id, 'cashier', NULL, s.denomination, s.qty
  FROM (
    SELECT (key)::bigint AS denomination, (value)::bigint AS qty
    FROM jsonb_each_text(v_chips)
    WHERE value ~ '^-?[0-9]+$'
  ) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chip_baseline cb
    WHERE cb.casino_id = _casino_id
      AND cb.location_type = 'cashier'
      AND cb.location_id IS NULL
      AND cb.denomination = s.denomination
  );

  -- 2) Per-casino initial baseline ← SUM(expected_quantity) per denom across ALL locations
  -- (cashier just updated above + untouched tables/safe).
  WITH per_denom AS (
    SELECT denomination, COALESCE(SUM(expected_quantity),0)::bigint AS qty
    FROM public.chip_baseline
    WHERE casino_id = _casino_id
    GROUP BY denomination
  ),
  ups AS (
    INSERT INTO public.chip_initial_baseline (casino_id, denomination, initial_quantity)
    SELECT _casino_id, denomination, qty FROM per_denom
    ON CONFLICT (casino_id, denomination)
    DO UPDATE SET initial_quantity = EXCLUDED.initial_quantity, updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_init_rows FROM ups;

  RETURN jsonb_build_object(
    'status','ok',
    'business_date', _business_date,
    'shift_id', v_shift.id,
    'cashier_baseline_rows_updated', v_loc_rows,
    'initial_rows_upserted', v_init_rows
  );
END;
$function$;