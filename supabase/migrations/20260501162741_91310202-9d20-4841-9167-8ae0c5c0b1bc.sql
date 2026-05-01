-- ============================================
-- 1) AUTO-CLOSE BUSINESS DAY at 05:00 EAT (02:00 UTC)
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_close_business_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_sessions_closed int := 0;
  v_visits_closed int := 0;
BEGIN
  -- Close all open client_sessions
  WITH updated AS (
    UPDATE public.client_sessions
       SET stopped_at = v_now,
           duration_minutes = GREATEST(0, EXTRACT(EPOCH FROM (v_now - started_at))::int / 60)
     WHERE stopped_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_sessions_closed FROM updated;

  -- Close all open casino_visits (any open visit, regardless of date — safety net)
  WITH updated AS (
    UPDATE public.casino_visits
       SET checked_out_at = v_now
     WHERE checked_out_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_visits_closed FROM updated;

  -- Audit row
  INSERT INTO public.cron_run_log(job_name, status, details)
  VALUES ('auto_close_business_day', 'ok',
          jsonb_build_object('sessions_closed', v_sessions_closed,
                             'visits_closed', v_visits_closed,
                             'ran_at', v_now));

  RETURN jsonb_build_object(
    'sessions_closed', v_sessions_closed,
    'visits_closed', v_visits_closed
  );
END;
$$;

-- Schedule: every day at 02:00 UTC = 05:00 Africa/Dar_es_Salaam
DO $$
BEGIN
  PERFORM cron.unschedule('auto_close_business_day');
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

SELECT cron.schedule(
  'auto_close_business_day',
  '0 2 * * *',
  $$ SELECT public.auto_close_business_day(); $$
);

-- ============================================
-- 2) STRICTER BREAKLIST RULE: 1 dealer + 1 inspector per table per slot
-- ============================================

CREATE OR REPLACE FUNCTION public.check_one_dealer_per_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_inspector boolean;
  v_existing_count int;
BEGIN
  -- BR / no-table assignments are unrestricted
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Inspector roles end with 'i' (ARi, BJi, Pi, AR1i, ARci, etc.)
  v_is_inspector := NEW.role::text ~ 'i$';

  -- Count existing assignments on the same table/slot of the SAME kind
  -- (inspector vs main dealer). Exclude this row in case of update.
  IF v_is_inspector THEN
    SELECT count(*) INTO v_existing_count
    FROM public.breaklist
    WHERE casino_id = NEW.casino_id
      AND date = NEW.date
      AND time_slot = NEW.time_slot
      AND table_id = NEW.table_id
      AND role::text ~ 'i$'
      AND dealer_id <> NEW.dealer_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'This table already has an inspector for this time slot';
    END IF;
  ELSE
    SELECT count(*) INTO v_existing_count
    FROM public.breaklist
    WHERE casino_id = NEW.casino_id
      AND date = NEW.date
      AND time_slot = NEW.time_slot
      AND table_id = NEW.table_id
      AND role::text !~ 'i$'
      AND dealer_id <> NEW.dealer_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'This table already has a dealer for this time slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;