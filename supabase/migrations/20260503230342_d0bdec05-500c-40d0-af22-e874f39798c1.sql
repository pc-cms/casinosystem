
-- 1. local_servers_overview: список всех локальных серверов с health
CREATE OR REPLACE FUNCTION public.local_servers_overview()
RETURNS TABLE (
  id uuid,
  casino_id uuid,
  server_name text,
  server_ip text,
  is_online boolean,
  last_sync_at timestamptz,
  health_updated_at timestamptz,
  current_version text,
  uptime_seconds bigint,
  containers_running integer,
  containers_total integer,
  disk_used_pct numeric,
  minutes_since_sync numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ls.id,
    ls.casino_id,
    ls.server_name,
    ls.server_ip,
    ls.is_online,
    ls.last_sync_at,
    ls.health_updated_at,
    (ls.health_snapshot->>'version')::text AS current_version,
    (ls.health_snapshot->>'uptime_seconds')::bigint AS uptime_seconds,
    (ls.health_snapshot->'containers'->>'running')::integer AS containers_running,
    (ls.health_snapshot->'containers'->>'total')::integer AS containers_total,
    (ls.health_snapshot->'disk'->>'used_pct')::numeric AS disk_used_pct,
    EXTRACT(EPOCH FROM (now() - ls.last_sync_at)) / 60 AS minutes_since_sync
  FROM public.local_servers ls
  WHERE has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'finance_manager'::app_role)
  ORDER BY ls.is_online DESC, ls.last_sync_at DESC NULLS LAST;
$$;

-- 2. sync_inbox_health: сколько входящих изменений / ошибок за 24ч
CREATE OR REPLACE FUNCTION public.sync_inbox_health()
RETURNS TABLE (
  casino_id uuid,
  total_24h bigint,
  errors_24h bigint,
  last_applied_at timestamptz,
  oldest_error_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    casino_id,
    COUNT(*) FILTER (WHERE applied_at >= now() - interval '24 hours') AS total_24h,
    COUNT(*) FILTER (WHERE applied_at >= now() - interval '24 hours' AND error IS NOT NULL) AS errors_24h,
    MAX(applied_at) AS last_applied_at,
    MIN(applied_at) FILTER (WHERE error IS NOT NULL AND applied_at >= now() - interval '24 hours') AS oldest_error_at
  FROM public.sync_inbox_log
  WHERE has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'finance_manager'::app_role)
  GROUP BY casino_id
  ORDER BY total_24h DESC;
$$;

-- 3. sync_outbox_per_table: разбивка outbox по таблицам (что именно застряло)
CREATE OR REPLACE FUNCTION public.sync_outbox_per_table()
RETURNS TABLE (
  casino_id uuid,
  table_name text,
  pending_count bigint,
  oldest_change_at timestamptz,
  oldest_minutes numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    casino_id,
    table_name,
    pending_count,
    oldest_change_at,
    oldest_minutes
  FROM public.sync_outbox_pending
  WHERE has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'finance_manager'::app_role)
  ORDER BY pending_count DESC, oldest_change_at;
$$;

GRANT EXECUTE ON FUNCTION public.local_servers_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_inbox_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_outbox_per_table() TO authenticated;
