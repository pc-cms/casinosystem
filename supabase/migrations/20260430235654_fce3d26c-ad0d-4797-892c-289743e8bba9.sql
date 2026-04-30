
-- 1. REVOKE EXECUTE FROM anon
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_active_visit_casino(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_card_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_rfid_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_apply_remote(uuid, bigint, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_casino_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_casino_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_date_for_casino(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_chip_consistency(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activity_logs_purge(integer) TO authenticated;

-- 2. STORAGE
DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view player photos"   ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view player documents" ON storage.objects;

CREATE POLICY "Authenticated read employee photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated read player photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-photos');

CREATE POLICY "Authenticated read player documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-documents');

-- 3. compute_shift_close: fix types
CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shift        RECORD;
  v_total_in     numeric := 0;
  v_total_out    numeric := 0;
  v_total_exp    numeric := 0;
  v_opening      numeric := 0;
  v_expected     numeric := 0;
  v_miss_total   numeric := 0;
  v_tables_res   numeric := 0;
  v_cash_result  numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift not found: %', p_shift_id;
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_total_in
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('buy','in');

  SELECT COALESCE(SUM(amount),0) INTO v_total_out
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('cashout','out');

  SELECT COALESCE(SUM(amount),0) INTO v_total_exp
    FROM public.expenses
   WHERE shift_id = p_shift_id;

  v_opening := COALESCE(((v_shift.opening_float -> 'totals' ->> 'total_tzs'))::numeric, 0);
  v_expected    := v_opening + v_total_in - v_total_out - v_total_exp;
  v_cash_result := v_total_in - v_total_out;

  BEGIN
    SELECT COALESCE(SUM(total_value_tzs),0) INTO v_miss_total
      FROM public.miss_chips
     WHERE shift_id = p_shift_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_miss_total := 0;
  END;

  BEGIN
    SELECT COALESCE(SUM(result),0) INTO v_tables_res
      FROM public.gaming_tables_history
     WHERE shift_id = p_shift_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_tables_res := 0;
  END;

  RETURN jsonb_build_object(
    'shift_id',       p_shift_id,
    'opening_float',  v_opening,
    'total_in',       v_total_in,
    'total_out',      v_total_out,
    'total_expenses', v_total_exp,
    'expected_cash',  v_expected,
    'cash_result',    v_cash_result,
    'miss_total',     v_miss_total,
    'tables_result',  v_tables_res,
    'shift_result',   v_cash_result + v_miss_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shift_close(uuid) TO authenticated;

-- 4. AGGREGATION VIEWS
CREATE OR REPLACE VIEW public.player_session_stats AS
SELECT
  s.casino_id,
  s.player_id,
  s.table_id,
  COUNT(*)                                   AS session_count,
  COALESCE(SUM(s.hands_played), 0)           AS hands,
  COALESCE(SUM(s.duration_minutes), 0)       AS minutes,
  COALESCE(SUM(s.total_bet), 0)              AS total_bet_sum,
  COALESCE(SUM((s.avg_bet)::numeric * s.hands_played), 0) AS bet_sum_by_avg,
  MIN(s.started_at)                          AS first_session_at,
  MAX(COALESCE(s.stopped_at, s.started_at))  AS last_session_at
FROM public.client_sessions s
GROUP BY s.casino_id, s.player_id, s.table_id;
GRANT SELECT ON public.player_session_stats TO authenticated;

CREATE OR REPLACE VIEW public.sessions_total_bet_sum AS
SELECT
  s.casino_id,
  date_trunc('day', s.started_at AT TIME ZONE 'Africa/Dar_es_Salaam' - INTERVAL '5 hours')::date AS business_date,
  COALESCE(SUM(s.total_bet), 0) AS total_bet
FROM public.client_sessions s
WHERE s.stopped_at IS NOT NULL
GROUP BY 1, 2;
GRANT SELECT ON public.sessions_total_bet_sum TO authenticated;

CREATE OR REPLACE VIEW public.player_session_drops AS
SELECT
  s.casino_id,
  s.player_id,
  COALESCE(SUM(s.total_bet), 0) AS drop_v
FROM public.client_sessions s
GROUP BY s.casino_id, s.player_id;
GRANT SELECT ON public.player_session_drops TO authenticated;

-- 5. SYNC HARDENING
ALTER TABLE public.sync_inbox_log
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sync_inbox_log_applied
  ON public.sync_inbox_log(applied_at);

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff   timestamptz := now() - INTERVAL '60 days';
  v_logs     bigint := 0;
  v_brk      bigint := 0;
  v_sess     bigint := 0;
  v_vis      bigint := 0;
  v_inbox    bigint := 0;
  v_outbox   bigint := 0;
BEGIN
  DELETE FROM public.activity_logs WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  DELETE FROM public.breaklist_logs WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_brk = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.client_sessions
     WHERE stopped_at IS NOT NULL AND stopped_at < v_cutoff
    RETURNING *
  )
  INSERT INTO public.client_sessions_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_sess = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.casino_visits
     WHERE checked_out_at IS NOT NULL AND checked_out_at < v_cutoff
    RETURNING *
  )
  INSERT INTO public.casino_visits_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_vis = ROW_COUNT;

  DELETE FROM public.sync_inbox_log WHERE applied_at < v_cutoff;
  GET DIAGNOSTICS v_inbox = ROW_COUNT;

  DELETE FROM public.sync_outbox WHERE changed_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_outbox = ROW_COUNT;

  INSERT INTO public.activity_logs (casino_id, operator_id, category, action, details)
  SELECT id, id, 'manager'::log_category, 'retention_cleanup',
         jsonb_build_object('cutoff', v_cutoff,
                            'activity_logs_deleted', v_logs,
                            'breaklist_logs_deleted', v_brk,
                            'sessions_archived', v_sess,
                            'visits_archived', v_vis,
                            'inbox_log_deleted', v_inbox,
                            'outbox_deleted', v_outbox)
    FROM public.casinos LIMIT 1;

  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'activity_logs_deleted', v_logs,
    'breaklist_logs_deleted', v_brk,
    'sessions_archived', v_sess,
    'visits_archived', v_vis,
    'inbox_log_deleted', v_inbox,
    'outbox_deleted', v_outbox
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_apply_remote(
  p_casino_id uuid, p_local_id bigint, p_table text,
  p_op text, p_pk jsonb, p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted boolean;
  v_sql      text;
  v_retries  integer;
BEGIN
  INSERT INTO public.sync_inbox_log (casino_id, local_id, table_name, op)
  VALUES (p_casino_id, p_local_id, p_table, p_op)
  ON CONFLICT (casino_id, local_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT retry_count INTO v_retries
      FROM public.sync_inbox_log
     WHERE casino_id = p_casino_id AND local_id = p_local_id;

    IF v_retries IS NULL OR v_retries >= 5 THEN
      RETURN jsonb_build_object('status','poison_pill','retries', v_retries);
    END IF;

    UPDATE public.sync_inbox_log
       SET retry_count = retry_count + 1
     WHERE casino_id = p_casino_id AND local_id = p_local_id;
  END IF;

  PERFORM set_config('sync.applying','on', true);

  IF p_op = 'DELETE' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table)
      USING (p_pk->>'id')::uuid;
  ELSE
    p_payload := jsonb_set(p_payload, '{casino_id}', to_jsonb(p_casino_id::text));

    v_sql := format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)
         ON CONFLICT (id) DO UPDATE SET (%s) = (%s)',
      p_table, p_table,
      (SELECT string_agg(quote_ident(column_name), ',')
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=p_table AND column_name <> 'id'),
      (SELECT string_agg('EXCLUDED.'||quote_ident(column_name), ',')
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=p_table AND column_name <> 'id')
    );
    EXECUTE v_sql USING p_payload;
  END IF;

  RETURN jsonb_build_object('status','applied');
EXCEPTION WHEN OTHERS THEN
  UPDATE public.sync_inbox_log
     SET error = SQLERRM,
         retry_count = COALESCE(retry_count,0) + 1
   WHERE casino_id = p_casino_id AND local_id = p_local_id;
  RETURN jsonb_build_object('status','error','error',SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_apply_remote(uuid, bigint, text, text, jsonb, jsonb) TO authenticated;

-- Pending outbox monitoring (no synced_at column — pending = age-based)
CREATE OR REPLACE VIEW public.sync_outbox_pending AS
SELECT
  o.casino_id,
  o.table_name,
  COUNT(*) AS pending_count,
  MIN(o.changed_at) AS oldest_change_at,
  EXTRACT(EPOCH FROM (now() - MIN(o.changed_at)))/60 AS oldest_minutes
FROM public.sync_outbox o
WHERE o.changed_at < now() - INTERVAL '5 minutes'
GROUP BY o.casino_id, o.table_name;

GRANT SELECT ON public.sync_outbox_pending TO authenticated;

-- 6. CRON MONITORING VIEW
CREATE OR REPLACE VIEW public.cron_recent_runs AS
SELECT
  j.jobname,
  d.start_time,
  d.end_time,
  d.status,
  d.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
WHERE d.start_time > now() - INTERVAL '7 days'
ORDER BY d.start_time DESC
LIMIT 200;

REVOKE ALL ON public.cron_recent_runs FROM anon, public;
GRANT SELECT ON public.cron_recent_runs TO authenticated;

-- 7. ARCHIVE RLS
ALTER TABLE public.client_sessions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_visits_archive   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super FM see archived sessions" ON public.client_sessions_archive;
CREATE POLICY "Super FM see archived sessions"
ON public.client_sessions_archive FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role));

DROP POLICY IF EXISTS "Super FM see archived visits" ON public.casino_visits_archive;
CREATE POLICY "Super FM see archived visits"
ON public.casino_visits_archive FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role));
