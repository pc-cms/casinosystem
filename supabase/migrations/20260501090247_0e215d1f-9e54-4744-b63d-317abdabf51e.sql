
-- ============================================================
-- Update Commands Outbox + cron monitoring helpers
-- ============================================================

-- 1) update_commands: super_admin queues a "deploy version X" command
--    for a specific casino's local server. The local cms-updater
--    polls this (via report-health echo or pull-changes) and applies.
CREATE TABLE IF NOT EXISTS public.update_commands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id   uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  target_version text NOT NULL,
  auto_apply  boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending', -- pending | acknowledged | applied | failed
  status_message text,
  issued_by   uuid NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  applied_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_update_commands_casino_status
  ON public.update_commands(casino_id, status, issued_at DESC);

ALTER TABLE public.update_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin manages update commands" ON public.update_commands;
CREATE POLICY "super_admin manages update commands"
  ON public.update_commands
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- finance_manager can view (for monitoring)
DROP POLICY IF EXISTS "fm reads update commands" ON public.update_commands;
CREATE POLICY "fm reads update commands"
  ON public.update_commands
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'finance_manager'::app_role));

-- 2) Helper RPC: list cron job health (super_admin only).
-- Reads from extensions.pg_cron — exposes recent run results without granting direct cron schema access.
CREATE OR REPLACE FUNCTION public.cron_health_overview()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  last_run_start timestamptz,
  last_status text,
  last_runtime_ms numeric,
  total_failures_24h bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    last_run.start_time AS last_run_start,
    last_run.status::text AS last_status,
    EXTRACT(EPOCH FROM (last_run.end_time - last_run.start_time)) * 1000 AS last_runtime_ms,
    COALESCE(fail24.cnt, 0) AS total_failures_24h
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, end_time, status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) last_run ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
      AND d.status = 'failed'
      AND d.start_time > now() - interval '24 hours'
  ) fail24 ON true
  ORDER BY j.jobname;
END $$;

REVOKE ALL ON FUNCTION public.cron_health_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_health_overview() TO authenticated;

-- 3) Helper RPC: sync outbox depth per casino (super_admin / finance_manager).
CREATE OR REPLACE FUNCTION public.sync_outbox_health()
RETURNS TABLE (
  casino_id uuid,
  pending_count bigint,
  oldest_pending_at timestamptz,
  failed_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role)
       OR has_role(auth.uid(), 'finance_manager'::app_role)) THEN
    RAISE EXCEPTION 'super_admin or finance_manager required';
  END IF;

  RETURN QUERY
  SELECT
    o.casino_id,
    COUNT(*) FILTER (WHERE o.status = 'pending') AS pending_count,
    MIN(o.created_at) FILTER (WHERE o.status = 'pending') AS oldest_pending_at,
    COUNT(*) FILTER (WHERE o.status = 'failed') AS failed_count
  FROM public.sync_outbox o
  WHERE o.created_at > now() - interval '7 days'
  GROUP BY o.casino_id;
END $$;

REVOKE ALL ON FUNCTION public.sync_outbox_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_outbox_health() TO authenticated;

-- 4) RPC to rotate a local_server sync_secret (super_admin only).
CREATE OR REPLACE FUNCTION public.rotate_local_server_secret(_server_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_secret text;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'super_admin role required';
  END IF;

  new_secret := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.local_servers
     SET sync_secret = new_secret
   WHERE id = _server_id;

  RETURN new_secret;
END $$;

REVOKE ALL ON FUNCTION public.rotate_local_server_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_local_server_secret(uuid) TO authenticated;
