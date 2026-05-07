CREATE OR REPLACE FUNCTION public.refresh_chip_initial_baseline(_casino_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recompute per-casino initial baseline = SUM of per-location expected quantities.
  -- Idempotent UPSERT: if a denom no longer exists in chip_baseline, leave its
  -- chip_initial_baseline row untouched (manual emissions / corrections are preserved).
  INSERT INTO public.chip_initial_baseline (casino_id, denomination, initial_quantity)
  SELECT _casino_id, cb.denomination, COALESCE(SUM(cb.expected_quantity), 0)
  FROM public.chip_baseline cb
  WHERE cb.casino_id = _casino_id
  GROUP BY cb.denomination
  ON CONFLICT (casino_id, denomination)
  DO UPDATE SET initial_quantity = EXCLUDED.initial_quantity,
                updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_chip_initial_baseline(uuid) FROM PUBLIC;

-- Patch close_business_day (3-arg overload) to refresh the initial baseline
-- BEFORE closing shifts, so trg_finalize_floor_on_shift_close has correct numbers.
CREATE OR REPLACE FUNCTION public.close_business_day(_casino_id uuid, _method text DEFAULT 'manual'::text, _force_close_cycles boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Refresh per-casino initial chip baseline from per-location baselines.
    -- Generates a fresh baseline for the next day and ensures the
    -- Floor → Miss trigger on shift close has the numbers it needs.
    PERFORM public.refresh_chip_initial_baseline(_casino_id);

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
    'method', _method
  );
END;
$function$;