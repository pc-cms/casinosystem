CREATE OR REPLACE FUNCTION public.get_current_business_date(_casino_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _last_closed date;
  _now_eat timestamp;
  _eat_hour int;
  _today date;
BEGIN
  SELECT MAX(business_date) INTO _last_closed
  FROM public.business_day_closures
  WHERE casino_id = _casino_id;

  _now_eat := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _eat_hour := EXTRACT(HOUR FROM _now_eat)::int;
  _today := _now_eat::date;

  IF _last_closed IS NOT NULL THEN
    RETURN LEAST(_last_closed + 1, _today);
  END IF;

  -- First-run fallback: the casino business day starts at 13:00 EAT
  -- and remains the previous calendar date until then.
  IF _eat_hour < 13 THEN
    RETURN _today - 1;
  END IF;

  RETURN _today;
END;
$$;

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

  RETURN jsonb_build_object('status', 'closed', 'business_date', v_today);
END;
$$;

DELETE FROM public.dealer_attendance da
USING public.dealers d
WHERE da.dealer_id = d.id
  AND d.casino_id = '48f4404f-7724-418c-8365-29af3998e113'::uuid
  AND da.date = '2026-05-03'
  AND da.value = '9';