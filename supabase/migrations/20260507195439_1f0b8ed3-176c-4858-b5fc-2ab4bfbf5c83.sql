
-- 1) Drop legacy / buggy functions
DROP FUNCTION IF EXISTS public.rebaseline_chips_from_closing_snapshot(uuid, date);
DROP FUNCTION IF EXISTS public.close_business_day(uuid, text);
DROP FUNCTION IF EXISTS public.close_business_day(uuid, text, boolean);

-- 2) New: apply cage shift closing to baselines (cashier float + initial total)
CREATE OR REPLACE FUNCTION public.apply_cage_shift_closing(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_casino uuid;
  v_chips jsonb;
  v_cashier_rows int := 0;
BEGIN
  SELECT casino_id, closing_count -> 'chips'
    INTO v_casino, v_chips
    FROM public.shifts
   WHERE id = _shift_id AND status = 'closed';

  IF v_casino IS NULL THEN
    RETURN jsonb_build_object('status','shift_not_closed','shift_id',_shift_id);
  END IF;
  IF v_chips IS NULL OR jsonb_typeof(v_chips) <> 'object' THEN
    RETURN jsonb_build_object('status','no_chips_in_closing','shift_id',_shift_id);
  END IF;

  -- 1) Cashier baseline ← cashier-entered, manager-confirmed closing chip counts.
  WITH src AS (
    SELECT (key)::bigint AS denomination, (value)::bigint AS qty
    FROM jsonb_each_text(v_chips)
    WHERE value ~ '^-?[0-9]+$'
  ),
  upd AS (
    UPDATE public.chip_baseline cb
       SET expected_quantity = s.qty
      FROM src s
     WHERE cb.casino_id = v_casino
       AND cb.location_type = 'cashier'
       AND cb.location_id IS NULL
       AND cb.denomination = s.denomination
       AND cb.expected_quantity IS DISTINCT FROM s.qty
     RETURNING 1
  )
  SELECT count(*) INTO v_cashier_rows FROM upd;

  INSERT INTO public.chip_baseline (casino_id, location_type, location_id, denomination, expected_quantity)
  SELECT v_casino, 'cashier', NULL, s.denomination, s.qty
  FROM (
    SELECT (key)::bigint AS denomination, (value)::bigint AS qty
    FROM jsonb_each_text(v_chips)
    WHERE value ~ '^-?[0-9]+$'
  ) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chip_baseline cb
    WHERE cb.casino_id = v_casino
      AND cb.location_type = 'cashier'
      AND cb.location_id IS NULL
      AND cb.denomination = s.denomination
  );

  -- 2) Per-casino initial baseline = SUM of per-location expected (cashier + tables + safe).
  INSERT INTO public.chip_initial_baseline (casino_id, denomination, initial_quantity)
  SELECT v_casino, cb.denomination, COALESCE(SUM(cb.expected_quantity),0)::bigint
  FROM public.chip_baseline cb
  WHERE cb.casino_id = v_casino
  GROUP BY cb.denomination
  ON CONFLICT (casino_id, denomination)
  DO UPDATE SET initial_quantity = EXCLUDED.initial_quantity, updated_at = now();

  RETURN jsonb_build_object(
    'status','ok',
    'shift_id', _shift_id,
    'casino_id', v_casino,
    'cashier_baseline_rows_updated', v_cashier_rows
  );
END;
$$;

-- 3) Trigger: fire rebaseline at the moment manager closes the shift
CREATE OR REPLACE FUNCTION public.trg_apply_cage_shift_closing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status,'') <> 'closed' THEN
    PERFORM public.apply_cage_shift_closing(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shifts_apply_cage_closing ON public.shifts;
CREATE TRIGGER shifts_apply_cage_closing
AFTER UPDATE OF status ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.trg_apply_cage_shift_closing();

-- 4) Clean close_business_day (3-arg) — NO chip rebaseline (done at shift close)
CREATE OR REPLACE FUNCTION public.close_business_day(
  _casino_id uuid,
  _method text DEFAULT 'manual',
  _force_close_cycles boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date;
  v_existing public.business_day_closures%ROWTYPE;
  v_snapshot jsonb;
  v_user uuid;
  v_lock_id uuid;
  v_open jsonb;
  v_finalize jsonb;
BEGIN
  v_user := auth.uid();

  IF _method = 'auto_11am' THEN
    v_today := ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1);
  ELSE
    v_today := public.get_current_business_date(_casino_id);
  END IF;

  IF _method = 'manual' THEN
    IF NOT (public.has_role(v_user, 'manager'::app_role)
         OR public.has_role(v_user, 'pit'::app_role)
         OR public.has_role(v_user, 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'Insufficient privileges to close business day';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.business_day_closures
  WHERE casino_id = _casino_id AND business_date = v_today;

  IF FOUND THEN
    RETURN jsonb_build_object('status','already_closed','business_date',v_today);
  END IF;

  v_open := public.list_open_cycles_for_day(_casino_id);

  IF _method = 'manual' AND NOT _force_close_cycles THEN
    IF jsonb_array_length(COALESCE(v_open->'open_cage_shifts','[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(v_open->'active_sessions','[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(v_open->'open_visits','[]'::jsonb)) > 0 THEN
      RETURN jsonb_build_object(
        'status','has_open_cycles',
        'business_date', v_today,
        'open', v_open
      );
    END IF;
  END IF;

  INSERT INTO public.system_locks(casino_id, reason, locked_until, created_by)
  VALUES (_casino_id, 'business_day_rollover', now() + interval '90 seconds', v_user)
  RETURNING id INTO v_lock_id;

  BEGIN
    v_finalize := public.finalize_open_cycles_for_close(_casino_id, v_user);
    v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);
    INSERT INTO public.business_day_closures (casino_id, business_date, closed_method, closed_by, snapshot)
    VALUES (_casino_id, v_today, _method, v_user, v_snapshot);
    PERFORM public.populate_table_daily_results_for_day(_casino_id, v_today, v_user);
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.system_locks WHERE id = v_lock_id;
    RAISE;
  END;

  DELETE FROM public.system_locks WHERE id = v_lock_id;

  RETURN jsonb_build_object(
    'status','closed',
    'business_date', v_today,
    'finalized', v_finalize,
    'method', _method
  );
END;
$$;
