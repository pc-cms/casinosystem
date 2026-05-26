
CREATE OR REPLACE FUNCTION public.reset_operational_dashboards(_casino_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tables_reset int := 0;
  v_cage_closed int := 0;
  v_slots_closed int := 0;
  v_note text := 'Auto-closed by 11:00 business-day rollover';
BEGIN
  -- Tables: clear closing draft data, mark closed. Pit will reopen.
  UPDATE public.gaming_tables
     SET closing_chips = NULL,
         closing_result = NULL,
         status = 'closed'
   WHERE casino_id = _casino_id
     AND (closing_chips IS NOT NULL OR closing_result IS NOT NULL OR status = 'open');
  GET DIAGNOSTICS v_tables_reset = ROW_COUNT;

  -- Live-game cage shifts left open → force-close with note
  UPDATE public.shifts
     SET status    = 'closed',
         closed_at = now(),
         notes     = COALESCE(NULLIF(notes,''), '') ||
                     CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END || v_note
   WHERE casino_id = _casino_id
     AND status = 'open';
  GET DIAGNOSTICS v_cage_closed = ROW_COUNT;

  -- Cage Slots shifts left unfinalised → auto-approve with note
  UPDATE public.cage_slots_shifts
     SET status          = 'approved',
         reviewed_at     = COALESCE(reviewed_at, now()),
         closed_at       = COALESCE(closed_at,   now()),
         manager_comment = COALESCE(NULLIF(manager_comment,''), '') ||
                           CASE WHEN COALESCE(manager_comment,'') = '' THEN '' ELSE E'\n' END || v_note,
         updated_at      = now()
   WHERE casino_id = _casino_id
     AND status IN ('open','draft','ready_for_review');
  GET DIAGNOSTICS v_slots_closed = ROW_COUNT;

  RETURN jsonb_build_object(
    'tables_reset', v_tables_reset,
    'cage_shifts_force_closed', v_cage_closed,
    'slots_shifts_auto_approved', v_slots_closed
  );
END;
$$;

-- Patch close_business_day to call the reset after snapshot insertion.
CREATE OR REPLACE FUNCTION public.close_business_day(
  _casino_id uuid, _method text, _force_close_cycles boolean DEFAULT false
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
  v_avg_finalize jsonb;
  v_reset jsonb;
BEGIN
  v_user := auth.uid();

  IF _method = 'auto_11am' THEN
    v_today := ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1);
  ELSE
    v_today := public.get_current_business_date(_casino_id);
  END IF;

  IF _method = 'manual' THEN
    IF NOT (public.is_manager_op(v_user)
         OR public.has_role(v_user, 'pit'::app_role)) THEN
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
    v_finalize := jsonb_build_object('forced', _force_close_cycles);

    BEGIN
      v_avg_finalize := public.finalize_player_daily_avg_bets(_casino_id, v_today);
    EXCEPTION WHEN OTHERS THEN
      v_avg_finalize := jsonb_build_object('error', SQLERRM);
    END;

    v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);

    INSERT INTO public.business_day_closures(
      casino_id, business_date, closed_by, closed_method, snapshot
    ) VALUES (
      _casino_id, v_today, v_user, _method, v_snapshot
    );

    -- Reset operational dashboards AFTER the snapshot is safely persisted.
    BEGIN
      v_reset := public.reset_operational_dashboards(_casino_id);
    EXCEPTION WHEN OTHERS THEN
      v_reset := jsonb_build_object('error', SQLERRM);
    END;

    DELETE FROM public.system_locks WHERE id = v_lock_id;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.system_locks WHERE id = v_lock_id;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'status','closed',
    'business_date', v_today,
    'forced', _force_close_cycles,
    'finalize', v_finalize,
    'avg_bets_finalize', v_avg_finalize,
    'reset', v_reset
  );
END;
$$;
