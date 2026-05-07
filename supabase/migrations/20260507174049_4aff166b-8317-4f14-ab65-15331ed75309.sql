-- Closing chip snapshot becomes the next day's baseline.
-- On business-day close, overwrite per-location chip_baseline.expected_quantity
-- and per-casino chip_initial_baseline.initial_quantity from the actual chip_snapshots
-- recorded for that day. This way Floor → Miss reconciliation on the next day starts
-- from "what physically remains in the cage right now" (after miss chips, emissions, etc.).

CREATE OR REPLACE FUNCTION public.rebaseline_chips_from_closing_snapshot(_casino_id uuid, _business_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loc_rows int := 0;
  v_init_rows int := 0;
  v_has_snapshot boolean;
BEGIN
  -- Skip silently if no snapshot was recorded for this day (nothing to rebaseline from)
  SELECT EXISTS(
    SELECT 1 FROM public.chip_snapshots
    WHERE casino_id = _casino_id AND date = _business_date
  ) INTO v_has_snapshot;

  IF NOT v_has_snapshot THEN
    RETURN jsonb_build_object('status','no_snapshot','business_date',_business_date);
  END IF;

  -- 1) Per-location baseline ← actual_quantity from latest snapshot row per (location_type, location_id, denomination)
  WITH latest AS (
    SELECT DISTINCT ON (location_type, location_id, denomination)
           casino_id, location_type, location_id, denomination, actual_quantity
    FROM public.chip_snapshots
    WHERE casino_id = _casino_id AND date = _business_date
    ORDER BY location_type, location_id, denomination, created_at DESC
  ),
  upd AS (
    UPDATE public.chip_baseline cb
       SET expected_quantity = l.actual_quantity
      FROM latest l
     WHERE cb.casino_id = l.casino_id
       AND cb.location_type = l.location_type
       AND cb.location_id IS NOT DISTINCT FROM l.location_id
       AND cb.denomination = l.denomination
       AND cb.expected_quantity IS DISTINCT FROM l.actual_quantity
     RETURNING 1
  )
  SELECT count(*) INTO v_loc_rows FROM upd;

  -- 2) Per-casino initial baseline ← sum across all locations from the same snapshot day
  WITH per_denom AS (
    SELECT denomination, COALESCE(SUM(actual_quantity),0)::bigint AS qty
    FROM (
      SELECT DISTINCT ON (location_type, location_id, denomination)
             location_type, location_id, denomination, actual_quantity
      FROM public.chip_snapshots
      WHERE casino_id = _casino_id AND date = _business_date
      ORDER BY location_type, location_id, denomination, created_at DESC
    ) s
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
    'baseline_rows_updated', v_loc_rows,
    'initial_rows_upserted', v_init_rows
  );
END;
$$;

-- Wire into close_business_day: rebaseline from the closing snapshot of the day being closed,
-- BEFORE finalizing open cycles (so the Floor→Miss trigger uses fresh numbers).
CREATE OR REPLACE FUNCTION public.close_business_day(_casino_id uuid, _method text DEFAULT 'manual'::text, _force_close_cycles boolean DEFAULT false)
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
  v_rebaseline jsonb;
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
    RETURN jsonb_build_object('status', 'already_closed', 'business_date', v_today);
  END IF;

  v_open := public.list_open_cycles_for_day(_casino_id);

  IF _method = 'manual' AND NOT _force_close_cycles THEN
    IF jsonb_array_length(v_open->'open_cage_shifts') > 0
       OR jsonb_array_length(v_open->'active_sessions') > 0
       OR jsonb_array_length(v_open->'open_visits') > 0 THEN
      RETURN jsonb_build_object(
        'status', 'has_open_cycles',
        'business_date', v_today,
        'open', v_open
      );
    END IF;
  END IF;

  INSERT INTO public.system_locks(casino_id, reason, locked_until, created_by)
  VALUES (_casino_id, 'business_day_rollover', now() + interval '90 seconds', v_user)
  RETURNING id INTO v_lock_id;

  BEGIN
    -- Closing snapshot becomes the next day's baseline.
    -- Per-location chip_baseline + per-casino chip_initial_baseline are overwritten
    -- with the actual_quantity values recorded in chip_snapshots for the day being closed.
    v_rebaseline := public.rebaseline_chips_from_closing_snapshot(_casino_id, v_today);

    -- Fallback: if there were no snapshots at all, still keep initial_baseline in sync
    -- with the per-location baseline so the Floor→Miss trigger has something to work with.
    IF (v_rebaseline->>'status') = 'no_snapshot' THEN
      PERFORM public.refresh_chip_initial_baseline(_casino_id);
    END IF;

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
    'status', 'closed',
    'business_date', v_today,
    'finalized', v_finalize,
    'rebaseline', v_rebaseline,
    'method', _method
  );
END;
$$;