
-- ============================================================
-- 1. Unified threshold: get_current_business_date — fallback 11:00 EAT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_business_date(_casino_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

  IF _eat_hour < 11 THEN
    RETURN _today - 1;
  END IF;
  RETURN _today;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_date_for_casino(_casino_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_current_business_date(_casino_id); $$;

-- ============================================================
-- 2. business_date column + trigger on operational tables (no backfill — immutability triggers block UPDATE)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='transactions' AND column_name='business_date') THEN
    ALTER TABLE public.transactions ADD COLUMN business_date date;
    CREATE INDEX idx_transactions_casino_bd ON public.transactions(casino_id, business_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='chip_transfers' AND column_name='business_date') THEN
    ALTER TABLE public.chip_transfers ADD COLUMN business_date date;
    CREATE INDEX idx_chip_transfers_casino_bd ON public.chip_transfers(casino_id, business_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='expenses' AND column_name='business_date') THEN
    ALTER TABLE public.expenses ADD COLUMN business_date date;
    CREATE INDEX idx_expenses_casino_bd ON public.expenses(casino_id, business_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='incidents' AND column_name='business_date') THEN
    ALTER TABLE public.incidents ADD COLUMN business_date date;
    CREATE INDEX idx_incidents_casino_bd ON public.incidents(casino_id, business_date);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.trg_set_business_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.business_date IS NULL THEN
    NEW.business_date := public.get_current_business_date(NEW.casino_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_business_date_transactions ON public.transactions;
CREATE TRIGGER set_business_date_transactions BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_business_date();

DROP TRIGGER IF EXISTS set_business_date_chip_transfers ON public.chip_transfers;
CREATE TRIGGER set_business_date_chip_transfers BEFORE INSERT ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_business_date();

DROP TRIGGER IF EXISTS set_business_date_expenses ON public.expenses;
CREATE TRIGGER set_business_date_expenses BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_business_date();

DROP TRIGGER IF EXISTS set_business_date_incidents ON public.incidents;
CREATE TRIGGER set_business_date_incidents BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_business_date();

CREATE OR REPLACE FUNCTION public.trg_set_visit_business_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.date := public.get_current_business_date(NEW.casino_id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. system_locks table (rollover lock)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_locks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id    uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  locked_until timestamptz NOT NULL,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_locks_casino_active
  ON public.system_locks(casino_id, locked_until DESC);

ALTER TABLE public.system_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in casino sees its locks" ON public.system_locks;
CREATE POLICY "Anyone in casino sees its locks"
  ON public.system_locks FOR SELECT TO authenticated
  USING (
    casino_id = public.get_user_casino_id(auth.uid())
    OR public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.has_role(auth.uid(),'finance_manager'::app_role)
  );

ALTER TABLE public.system_locks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='system_locks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.system_locks';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='business_day_closures') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.business_day_closures';
  END IF;
END$$;

-- ============================================================
-- 4. List open cycles RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_open_cycles_for_day(_casino_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_open_shifts jsonb; v_active_sessions jsonb; v_open_visits jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'opened_at',s.opened_at,'opened_by',s.opened_by)),'[]'::jsonb)
    INTO v_open_shifts
    FROM public.shifts s WHERE s.casino_id = _casino_id AND s.status = 'open';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',cs.id,'player_id',cs.player_id,'table_id',cs.table_id,'started_at',cs.started_at)),'[]'::jsonb)
    INTO v_active_sessions
    FROM public.client_sessions cs WHERE cs.casino_id = _casino_id AND cs.stopped_at IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',cv.id,'player_id',cv.player_id,'checked_in_at',cv.checked_in_at)),'[]'::jsonb)
    INTO v_open_visits
    FROM public.casino_visits cv WHERE cv.casino_id = _casino_id AND cv.checked_out_at IS NULL;

  RETURN jsonb_build_object(
    'open_cage_shifts', v_open_shifts,
    'active_sessions',  v_active_sessions,
    'open_visits',      v_open_visits
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_open_cycles_for_day(uuid) TO authenticated;

-- ============================================================
-- 5. Force-finalize helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_open_cycles_for_close(_casino_id uuid, _user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_shifts_closed int := 0; v_sessions_closed int := 0; v_visits_closed int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.client_sessions SET stopped_at = now()
     WHERE casino_id = _casino_id AND stopped_at IS NULL RETURNING 1
  ) SELECT count(*) INTO v_sessions_closed FROM upd;

  WITH upd AS (
    UPDATE public.casino_visits
       SET checked_out_at = now(), position = 'hall'
     WHERE casino_id = _casino_id AND checked_out_at IS NULL RETURNING 1
  ) SELECT count(*) INTO v_visits_closed FROM upd;

  WITH upd AS (
    UPDATE public.shifts
       SET status = 'closed',
           closed_at = now(),
           closed_by = COALESCE(closed_by, _user),
           notes = COALESCE(notes,'') || E'\n[auto-closed by business-day close]'
     WHERE casino_id = _casino_id AND status = 'open' RETURNING 1
  ) SELECT count(*) INTO v_shifts_closed FROM upd;

  RETURN jsonb_build_object(
    'sessions_closed', v_sessions_closed,
    'visits_closed', v_visits_closed,
    'shifts_closed', v_shifts_closed
  );
END;
$$;

-- ============================================================
-- 6. Rewritten close_business_day with lock + finalize
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_business_day(
  _casino_id uuid,
  _method text DEFAULT 'manual',
  _force_close_cycles boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
$$;

GRANT EXECUTE ON FUNCTION public.close_business_day(uuid, text, boolean) TO authenticated;

-- ============================================================
-- 7. 05:00 EAT venue close: stop sessions + checkout visits
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_open_sessions_5am()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _eat timestamp := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _hour int := EXTRACT(HOUR FROM _eat)::int;
  v_sessions int := 0; v_visits int := 0;
BEGIN
  IF _hour < 5 OR _hour >= 11 THEN
    RETURN jsonb_build_object('status','skipped','hour',_hour);
  END IF;

  WITH upd AS (
    UPDATE public.client_sessions SET stopped_at = now()
     WHERE stopped_at IS NULL RETURNING 1
  ) SELECT count(*) INTO v_sessions FROM upd;

  WITH upd AS (
    UPDATE public.casino_visits
       SET checked_out_at = now(), position = 'hall'
     WHERE checked_out_at IS NULL RETURNING 1
  ) SELECT count(*) INTO v_visits FROM upd;

  INSERT INTO public.cron_run_log(job_name, status, duration_ms, details)
  VALUES('close_open_sessions_5am','ok',0, jsonb_build_object('sessions',v_sessions,'visits',v_visits));

  RETURN jsonb_build_object('status','ok','sessions',v_sessions,'visits',v_visits);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_open_sessions_5am() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='close-open-sessions-5am') THEN
    PERFORM cron.schedule(
      'close-open-sessions-5am','5 * * * *',
      $cron$ SELECT public.close_open_sessions_5am(); $cron$
    );
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END$$;

-- ============================================================
-- 8. NEP-walk uses real business_date
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_players_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(player_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  prev_pid uuid := NULL; prev_bd date := NULL;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (player_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;
  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id, e.bd
      FROM (
      SELECT t.player_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint AS amount, true AS is_cash,
             t.created_at, t.id,
             COALESCE(t.business_date, ((t.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '11 hours')::date) AS bd
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id
      UNION ALL
      SELECT ct.player_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id,
             COALESCE(ct.business_date, ((ct.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '11 hours')::date)
        FROM public.chip_transfers ct WHERE ct.casino_id = _casino_id
      UNION ALL
      SELECT pca.player_id, 'in', pca.chip_in::bigint, true, pca.created_at, pca.id, pca.business_date
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_in > 0
      UNION ALL
      SELECT pca.player_id, 'out', pca.chip_out::bigint, true, pca.created_at, pca.id, pca.business_date
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_out > 0
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.pid IS DISTINCT FROM prev_pid OR r.bd IS DISTINCT FROM prev_bd THEN
      nep := 0; prev_pid := r.pid; prev_bd := r.bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from THEN
        INSERT INTO _tmp_psplit VALUES (r.pid, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  RETURN QUERY
    SELECT s.player_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
      FROM _tmp_psplit s GROUP BY s.player_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  prev_pid uuid := NULL; prev_bd date := NULL;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_split (table_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_split;
  FOR r IN
    SELECT e.player_id, e.t_table_id AS table_id, e.kind, e.amount, e.is_cash, e.created_at, e.id, e.bd
      FROM (
      SELECT t.player_id, t.table_id AS t_table_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint, true, t.created_at, t.id,
             COALESCE(t.business_date, ((t.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '11 hours')::date) AS bd
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id
      UNION ALL
      SELECT ct.player_id, ct.table_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id,
             COALESCE(ct.business_date, ((ct.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '11 hours')::date)
        FROM public.chip_transfers ct WHERE ct.casino_id = _casino_id
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'in', pca.chip_in::bigint, true, pca.created_at, pca.id, pca.business_date
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_in > 0
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'out', pca.chip_out::bigint, true, pca.created_at, pca.id, pca.business_date
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_out > 0
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.player_id IS DISTINCT FROM prev_pid OR r.bd IS DISTINCT FROM prev_bd THEN
      nep := 0; prev_pid := r.player_id; prev_bd := r.bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from AND r.table_id IS NOT NULL THEN
        INSERT INTO _tmp_split VALUES (r.table_id, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  RETURN QUERY
    SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
      FROM _tmp_split s GROUP BY s.table_id;
END;
$$;
