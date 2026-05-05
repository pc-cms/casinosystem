CREATE OR REPLACE FUNCTION public.close_business_day(_casino_id uuid, _method text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date;
  v_existing business_day_closures%ROWTYPE;
  v_snapshot jsonb;
  v_user uuid;
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
  FROM business_day_closures
  WHERE casino_id = _casino_id AND business_date = v_today;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_closed', 'business_date', v_today);
  END IF;

  v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);

  INSERT INTO business_day_closures (casino_id, business_date, closed_method, closed_by, snapshot)
  VALUES (_casino_id, v_today, _method, v_user, v_snapshot);

  PERFORM public.populate_table_daily_results_for_day(_casino_id, v_today, v_user);

  RETURN jsonb_build_object('status', 'closed', 'business_date', v_today);
END;
$$;