
-- ============================================================
-- 1. TABLE: business_day_closures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_day_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  closed_method text NOT NULL CHECK (closed_method IN ('manual','auto_11am')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (casino_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_bdc_casino_date
  ON public.business_day_closures (casino_id, business_date DESC);

ALTER TABLE public.business_day_closures ENABLE ROW LEVEL SECURITY;

-- Read: any user from the casino + super admin/FM + surveillance
CREATE POLICY "Casino users see closures"
  ON public.business_day_closures FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Super/FM see all closures"
  ON public.business_day_closures FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Surveillance sees closures"
  ON public.business_day_closures FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role)
     AND user_has_casino_access(auth.uid(), casino_id));

-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER RPCs can write.

-- ============================================================
-- 2. FUNCTION: get_current_business_date
-- Returns the currently OPEN business date for a casino.
-- Logic: last_closure.business_date + 1, OR fallback to legacy 05:00 calc.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_business_date(_casino_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

  -- EAT wall clock
  _now_eat := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _eat_hour := EXTRACT(HOUR FROM _now_eat)::int;
  _today := _now_eat::date;

  IF _last_closed IS NOT NULL THEN
    -- Open day = day after last closure, but never in the future
    RETURN LEAST(_last_closed + 1, _today);
  END IF;

  -- Fallback (no closures yet): legacy 05:00 rollover
  IF _eat_hour < 5 THEN
    RETURN _today - 1;
  END IF;
  RETURN _today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_business_date(uuid) TO authenticated;

-- ============================================================
-- 3. FUNCTION: close_business_day (manual or auto)
-- Idempotent — second call for the same date is a no-op.
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_business_day(
  _casino_id uuid,
  _method text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bd date;
  _existing_id uuid;
  _new_id uuid;
  _snapshot jsonb;
  _is_manager boolean := false;
  _is_pit boolean := false;
BEGIN
  IF _method NOT IN ('manual','auto_11am') THEN
    RAISE EXCEPTION 'Invalid method: %', _method;
  END IF;

  -- Authorization: manual close requires Manager or Pit; auto runs as definer (no auth.uid)
  IF _method = 'manual' THEN
    IF _uid IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;
    _is_manager := has_role(_uid, 'manager'::app_role);
    _is_pit     := has_role(_uid, 'pit'::app_role);
    IF NOT (_is_manager OR _is_pit) THEN
      RAISE EXCEPTION 'Only Pit or Manager can close the business day';
    END IF;
    -- Casino scoping
    IF get_user_casino_id(_uid) <> _casino_id
       AND NOT has_role(_uid, 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Cannot close another casino''s day';
    END IF;
  END IF;

  _bd := public.get_current_business_date(_casino_id);

  -- Idempotency
  SELECT id INTO _existing_id
  FROM public.business_day_closures
  WHERE casino_id = _casino_id AND business_date = _bd;
  IF _existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already_closed',
      'business_date',_bd,
      'closure_id',_existing_id
    );
  END IF;

  -- Build a snapshot of headline figures (best-effort; non-fatal if tables empty)
  SELECT jsonb_build_object(
    'visits_count',
       (SELECT COUNT(*) FROM public.casino_visits
         WHERE casino_id = _casino_id AND date = _bd),
    'tables_with_result',
       (SELECT COUNT(*) FROM public.gaming_tables
         WHERE casino_id = _casino_id AND closing_result IS NOT NULL),
    'closed_via', _method
  ) INTO _snapshot;

  INSERT INTO public.business_day_closures
    (casino_id, business_date, closed_by, closed_method, snapshot)
  VALUES
    (_casino_id, _bd, _uid, _method, COALESCE(_snapshot, '{}'::jsonb))
  RETURNING id INTO _new_id;

  -- Activity log (best-effort)
  BEGIN
    INSERT INTO public.activity_logs (casino_id, operator_id, action, category, details)
    VALUES (_casino_id, COALESCE(_uid, _casino_id), 'BUSINESS_DAY_CLOSED', 'system'::log_category,
            jsonb_build_object('business_date', _bd, 'method', _method));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'status','closed',
    'business_date',_bd,
    'closure_id',_new_id,
    'method',_method
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_business_day(uuid, text) TO authenticated;

-- ============================================================
-- 4. AUTO-CLOSE: hourly cron, only acts after 11:00 EAT
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_close_forgotten_business_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eat timestamp := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _eat_hour int := EXTRACT(HOUR FROM _eat)::int;
  _today date := _eat::date;
  _yesterday date := _today - 1;
  _r record;
BEGIN
  -- Only act between 11:00 and 23:59 EAT
  IF _eat_hour < 11 THEN
    RETURN;
  END IF;

  FOR _r IN
    SELECT c.id AS casino_id
    FROM public.casinos c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.business_day_closures b
      WHERE b.casino_id = c.id
        AND b.business_date = _yesterday
    )
  LOOP
    BEGIN
      PERFORM public.close_business_day(_r.casino_id, 'auto_11am');
    EXCEPTION WHEN OTHERS THEN
      -- Skip on per-casino failure; do not abort the whole sweep
      NULL;
    END;
  END LOOP;
END;
$$;

-- Schedule cron (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-business-day') THEN
    PERFORM cron.schedule(
      'auto-close-business-day',
      '5 * * * *',  -- every hour at :05
      $cron$ SELECT public.auto_close_forgotten_business_days(); $cron$
    );
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- pg_cron not installed — skip; on-prem deployments can install later
  NULL;
END$$;
