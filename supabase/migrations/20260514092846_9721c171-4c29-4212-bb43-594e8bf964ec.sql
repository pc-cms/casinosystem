
DROP FUNCTION IF EXISTS public.close_business_day(uuid, text, boolean);

CREATE FUNCTION public.close_business_day(_casino_id uuid, _method text, _force_close_cycles boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    IF _force_close_cycles THEN
      v_finalize := public.finalize_open_cycles(_casino_id, v_today);
    ELSE
      v_finalize := jsonb_build_object('forced', false);
    END IF;

    v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);

    INSERT INTO public.business_day_closures(
      casino_id, business_date, closed_by, closed_method, snapshot
    ) VALUES (
      _casino_id, v_today, v_user, _method, v_snapshot
    );

    DELETE FROM public.system_locks WHERE id = v_lock_id;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.system_locks WHERE id = v_lock_id;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'status','closed',
    'business_date', v_today,
    'forced', _force_close_cycles,
    'finalize', v_finalize
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.build_business_day_snapshot(_casino_id uuid, _business_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
BEGIN
  result := jsonb_set(result, '{cash_counts}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cash_count_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.created_at::date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{expenses}', COALESCE((
    SELECT jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at)
    FROM expenses e
    LEFT JOIN shifts s ON s.id = e.shift_id
    WHERE e.casino_id = _casino_id
      AND (
        (s.opened_at IS NOT NULL
          AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
               - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
              ) = _business_date)
        OR (s.id IS NULL AND e.created_at::date = _business_date)
      )
  ), '[]'::jsonb));

  result := jsonb_set(result, '{cashless}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cashless_transactions c
    WHERE c.casino_id = _casino_id
      AND c.business_date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{table_tracker}', COALESCE((
    SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.time_slot)
    FROM table_tracker t
    WHERE t.casino_id = _casino_id
      AND t.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{chip_snapshots}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM chip_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{breaklist}', COALESCE((
    SELECT jsonb_agg(to_jsonb(b.*) ORDER BY b.time_slot, b.employee_id)
    FROM breaklist b
    WHERE b.casino_id = _casino_id
      AND b.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{player_stats}', COALESCE((
    SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.started_at)
    FROM client_sessions s
    WHERE s.casino_id = _casino_id
      AND s.started_at::date = _business_date
  ), '[]'::jsonb));

  RETURN result;
END;
$$;
