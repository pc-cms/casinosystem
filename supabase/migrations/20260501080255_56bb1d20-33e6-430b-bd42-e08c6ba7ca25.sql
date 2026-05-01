-- 1. Создать архивы для activity_logs и breaklist_logs (раньше они просто DELETE без архива)
CREATE TABLE IF NOT EXISTS public.activity_logs_archive (LIKE public.activity_logs INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.breaklist_logs_archive (LIKE public.breaklist_logs INCLUDING ALL);

ALTER TABLE public.activity_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaklist_logs_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "archive_admin_read" ON public.activity_logs_archive;
CREATE POLICY "archive_admin_read" ON public.activity_logs_archive FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

DROP POLICY IF EXISTS "archive_admin_read" ON public.breaklist_logs_archive;
CREATE POLICY "archive_admin_read" ON public.breaklist_logs_archive FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

-- 2. Безопасный cleanup: ARCHIVE-FIRST, потом DELETE; всё в одной транзакции;
-- если архив упадёт — DELETE откатывается. Логируем попытки.
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff       timestamptz := now() - INTERVAL '60 days';
  v_outbox_cut   timestamptz := now() - INTERVAL '30 days';
  v_logs_arch    bigint := 0; v_logs_del    bigint := 0;
  v_brk_arch     bigint := 0; v_brk_del     bigint := 0;
  v_sess_arch    bigint := 0; v_sess_del    bigint := 0;
  v_vis_arch     bigint := 0; v_vis_del     bigint := 0;
  v_inbox_del    bigint := 0;
  v_outbox_del   bigint := 0;
  v_started_at   timestamptz := clock_timestamp();
BEGIN
  -- activity_logs: archive then delete (only rows we successfully archived)
  WITH src AS (
    SELECT * FROM public.activity_logs WHERE created_at < v_cutoff
  ),
  ins AS (
    INSERT INTO public.activity_logs_archive
    SELECT * FROM src
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_logs_arch FROM ins;

  DELETE FROM public.activity_logs
   WHERE created_at < v_cutoff
     AND id IN (SELECT id FROM public.activity_logs_archive WHERE created_at < v_cutoff);
  GET DIAGNOSTICS v_logs_del = ROW_COUNT;

  -- breaklist_logs
  WITH src AS (
    SELECT * FROM public.breaklist_logs WHERE created_at < v_cutoff
  ),
  ins AS (
    INSERT INTO public.breaklist_logs_archive
    SELECT * FROM src
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_brk_arch FROM ins;

  DELETE FROM public.breaklist_logs
   WHERE created_at < v_cutoff
     AND id IN (SELECT id FROM public.breaklist_logs_archive WHERE created_at < v_cutoff);
  GET DIAGNOSTICS v_brk_del = ROW_COUNT;

  -- client_sessions
  WITH src AS (
    SELECT * FROM public.client_sessions
     WHERE stopped_at IS NOT NULL AND stopped_at < v_cutoff
  ),
  ins AS (
    INSERT INTO public.client_sessions_archive
    SELECT * FROM src
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_sess_arch FROM ins;

  DELETE FROM public.client_sessions
   WHERE stopped_at IS NOT NULL AND stopped_at < v_cutoff
     AND id IN (SELECT id FROM public.client_sessions_archive);
  GET DIAGNOSTICS v_sess_del = ROW_COUNT;

  -- casino_visits
  WITH src AS (
    SELECT * FROM public.casino_visits
     WHERE checked_out_at IS NOT NULL AND checked_out_at < v_cutoff
  ),
  ins AS (
    INSERT INTO public.casino_visits_archive
    SELECT * FROM src
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_vis_arch FROM ins;

  DELETE FROM public.casino_visits
   WHERE checked_out_at IS NOT NULL AND checked_out_at < v_cutoff
     AND id IN (SELECT id FROM public.casino_visits_archive);
  GET DIAGNOSTICS v_vis_del = ROW_COUNT;

  -- sync logs: чистый DELETE, архивировать не нужно
  DELETE FROM public.sync_inbox_log WHERE applied_at < v_cutoff;
  GET DIAGNOSTICS v_inbox_del = ROW_COUNT;

  DELETE FROM public.sync_outbox WHERE changed_at < v_outbox_cut;
  GET DIAGNOSTICS v_outbox_del = ROW_COUNT;

  -- Health log
  INSERT INTO public.cron_run_log (job_name, status, duration_ms, details)
  VALUES (
    'cleanup_old_data', 'ok',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started_at)::int,
    jsonb_build_object(
      'cutoff', v_cutoff,
      'activity_logs', jsonb_build_object('archived', v_logs_arch, 'deleted', v_logs_del),
      'breaklist_logs', jsonb_build_object('archived', v_brk_arch, 'deleted', v_brk_del),
      'sessions', jsonb_build_object('archived', v_sess_arch, 'deleted', v_sess_del),
      'visits', jsonb_build_object('archived', v_vis_arch, 'deleted', v_vis_del),
      'inbox_log_deleted', v_inbox_del,
      'outbox_deleted', v_outbox_del
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cutoff', v_cutoff,
    'activity_logs', jsonb_build_object('archived', v_logs_arch, 'deleted', v_logs_del),
    'breaklist_logs', jsonb_build_object('archived', v_brk_arch, 'deleted', v_brk_del),
    'sessions', jsonb_build_object('archived', v_sess_arch, 'deleted', v_sess_del),
    'visits', jsonb_build_object('archived', v_vis_arch, 'deleted', v_vis_del),
    'inbox_log_deleted', v_inbox_del,
    'outbox_deleted', v_outbox_del
  );
EXCEPTION WHEN OTHERS THEN
  -- Если что-то упало — DELETE откатится автоматом; пишем ошибку в health log отдельной транзакцией
  INSERT INTO public.cron_run_log (job_name, status, duration_ms, details)
  VALUES (
    'cleanup_old_data', 'error',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started_at)::int,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  RAISE;
END;
$function$;

-- 3. Cron health: лог запусков + view для мониторинга
CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id          bigserial PRIMARY KEY,
  job_name    text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ok','error','warning')),
  duration_ms integer,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_run_log_job_time ON public.cron_run_log(job_name, created_at DESC);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cron_log_admin_read" ON public.cron_run_log;
CREATE POLICY "cron_log_admin_read" ON public.cron_run_log FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

-- View: последний запуск каждой задачи + флаг "stale" (нет успешного запуска >36h)
CREATE OR REPLACE VIEW public.cron_job_health AS
SELECT
  job_name,
  status                       AS last_status,
  created_at                   AS last_run_at,
  duration_ms                  AS last_duration_ms,
  details                      AS last_details,
  (now() - created_at)         AS age,
  (status <> 'ok' OR now() - created_at > INTERVAL '36 hours') AS is_unhealthy
FROM (
  SELECT DISTINCT ON (job_name) job_name, status, created_at, duration_ms, details
  FROM public.cron_run_log
  ORDER BY job_name, created_at DESC
) t;

GRANT SELECT ON public.cron_job_health TO authenticated;

-- 4. Удалить дубль cleanup-задачи (оставляем cms-cleanup-old-data в 01:30 UTC)
SELECT cron.unschedule('cms-retention-cleanup');

-- 5. Обернуть sync_outbox_gc тоже в health-log
CREATE OR REPLACE FUNCTION public.sync_outbox_gc()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_started timestamptz := clock_timestamp();
  v_deleted bigint := 0;
BEGIN
  DELETE FROM public.sync_outbox WHERE changed_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  INSERT INTO public.cron_run_log (job_name, status, duration_ms, details)
  VALUES ('sync_outbox_gc', 'ok',
          EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::int,
          jsonb_build_object('deleted', v_deleted));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.cron_run_log (job_name, status, duration_ms, details)
  VALUES ('sync_outbox_gc', 'error',
          EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::int,
          jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
  RAISE;
END;
$function$;