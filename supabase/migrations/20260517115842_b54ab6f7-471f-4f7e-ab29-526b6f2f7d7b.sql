-- =====================================================================
-- v1.3.49 Mirror Health & Diagnostics infrastructure
-- =====================================================================

-- 0. Helper: assert super_admin (used by RPCs)
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin')
$$;

-- 1. sync_peer_health (upsert-only; no history, one row per peer_link)
CREATE TABLE IF NOT EXISTS public.sync_peer_health (
  peer_link_id uuid PRIMARY KEY REFERENCES public.peer_links(id) ON DELETE CASCADE,
  peer_node_id uuid,
  peer_name text,
  state text NOT NULL DEFAULT 'pairing'
    CHECK (state IN ('ok','degraded','broken','pairing','schema_mismatch','snapshot_required')),
  last_heartbeat_at timestamptz,
  last_push_ok_at timestamptz,
  last_pull_ok_at timestamptz,
  last_apply_ok_at timestamptz,
  last_probe_latency_ms integer,
  last_probe_at timestamptz,
  pending_outbox_count integer NOT NULL DEFAULT 0,
  remote_lag_seconds integer,
  schema_version_local text,
  schema_version_remote text,
  apply_errors_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_peer_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_health read auth" ON public.sync_peer_health
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "peer_health write super_admin" ON public.sync_peer_health
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. sync_apply_errors
CREATE TABLE IF NOT EXISTS public.sync_apply_errors (
  id bigserial PRIMARY KEY,
  peer_link_id uuid REFERENCES public.peer_links(id) ON DELETE SET NULL,
  peer_name text,
  source_outbox_id bigint,
  table_name text NOT NULL,
  op text,
  pk jsonb,
  payload_hash text,
  error_code text NOT NULL,
  error_text text,
  attempts integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolution    text
);
CREATE INDEX IF NOT EXISTS idx_apply_errors_unresolved
  ON public.sync_apply_errors (resolved_at NULLS FIRST, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_apply_errors_peer
  ON public.sync_apply_errors (peer_link_id, last_seen_at DESC);
ALTER TABLE public.sync_apply_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apply_errors read auth" ON public.sync_apply_errors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "apply_errors write super_admin" ON public.sync_apply_errors
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. sync_probe_events
CREATE TABLE IF NOT EXISTS public.sync_probe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_link_id uuid REFERENCES public.peer_links(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('out','in')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  ack_at  timestamptz,
  status  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','timeout','error')),
  latency_ms integer,
  error_text text
);
CREATE INDEX IF NOT EXISTS idx_probe_events_peer ON public.sync_probe_events (peer_link_id, sent_at DESC);
ALTER TABLE public.sync_probe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "probe_events read auth" ON public.sync_probe_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "probe_events write super_admin" ON public.sync_probe_events
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. sync_snapshot_state
CREATE TABLE IF NOT EXISTS public.sync_snapshot_state (
  casino_id uuid PRIMARY KEY,
  snapshot_id text,
  source text,
  source_created_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum text
);
ALTER TABLE public.sync_snapshot_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshot_state read auth" ON public.sync_snapshot_state
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "snapshot_state write super_admin" ON public.sync_snapshot_state
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. casino_servers.role enum + uniqueness
DO $$ BEGIN
  CREATE TYPE public.casino_server_role AS ENUM ('primary','replica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- casino_servers may not exist yet in some installs; create a minimal table if needed
CREATE TABLE IF NOT EXISTS public.casino_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  node_id uuid,
  display_name text,
  local_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.casino_servers ADD COLUMN role public.casino_server_role NOT NULL DEFAULT 'replica';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_primary_per_casino
  ON public.casino_servers (casino_id) WHERE role = 'primary';

ALTER TABLE public.casino_servers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "casino_servers read auth" ON public.casino_servers
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "casino_servers write super_admin" ON public.casino_servers
    FOR ALL TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. RPCs (service_role + super_admin)

-- 6a. sync_record_health — UPSERT one row per peer
CREATE OR REPLACE FUNCTION public.sync_record_health(
  p_peer_link_id uuid,
  p_state text,
  p_heartbeat_at timestamptz DEFAULT now(),
  p_pending_outbox integer DEFAULT NULL,
  p_remote_lag_seconds integer DEFAULT NULL,
  p_schema_version_local text DEFAULT NULL,
  p_schema_version_remote text DEFAULT NULL,
  p_last_error_code text DEFAULT NULL,
  p_last_error_text text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_node uuid;
BEGIN
  SELECT display_name, peer_node_id INTO v_name, v_node
    FROM public.peer_links WHERE id = p_peer_link_id;
  INSERT INTO public.sync_peer_health AS h
    (peer_link_id, peer_node_id, peer_name, state, last_heartbeat_at,
     pending_outbox_count, remote_lag_seconds,
     schema_version_local, schema_version_remote,
     last_error_code, last_error_text, updated_at)
  VALUES
    (p_peer_link_id, v_node, v_name, p_state, p_heartbeat_at,
     COALESCE(p_pending_outbox,0), p_remote_lag_seconds,
     p_schema_version_local, p_schema_version_remote,
     p_last_error_code, p_last_error_text, now())
  ON CONFLICT (peer_link_id) DO UPDATE SET
    peer_node_id = COALESCE(EXCLUDED.peer_node_id, h.peer_node_id),
    peer_name = COALESCE(EXCLUDED.peer_name, h.peer_name),
    state = EXCLUDED.state,
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    pending_outbox_count = COALESCE(EXCLUDED.pending_outbox_count, h.pending_outbox_count),
    remote_lag_seconds = COALESCE(EXCLUDED.remote_lag_seconds, h.remote_lag_seconds),
    schema_version_local = COALESCE(EXCLUDED.schema_version_local, h.schema_version_local),
    schema_version_remote = COALESCE(EXCLUDED.schema_version_remote, h.schema_version_remote),
    last_error_code = EXCLUDED.last_error_code,
    last_error_text = EXCLUDED.last_error_text,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.sync_record_apply_ok(p_peer_link_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sync_peer_health
     SET last_apply_ok_at = now(), updated_at = now()
   WHERE peer_link_id = p_peer_link_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_record_push_ok(p_peer_link_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sync_peer_health
     SET last_push_ok_at = now(), updated_at = now()
   WHERE peer_link_id = p_peer_link_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_record_pull_ok(p_peer_link_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sync_peer_health
     SET last_pull_ok_at = now(), updated_at = now()
   WHERE peer_link_id = p_peer_link_id;
$$;

-- 6b. sync_record_apply_error
CREATE OR REPLACE FUNCTION public.sync_record_apply_error(
  p_peer_link_id uuid,
  p_source_outbox_id bigint,
  p_table text,
  p_op text,
  p_pk jsonb,
  p_payload_hash text,
  p_error_code text,
  p_error_text text
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint; v_name text;
BEGIN
  SELECT display_name INTO v_name FROM public.peer_links WHERE id = p_peer_link_id;
  INSERT INTO public.sync_apply_errors
    (peer_link_id, peer_name, source_outbox_id, table_name, op, pk, payload_hash,
     error_code, error_text)
  VALUES
    (p_peer_link_id, v_name, p_source_outbox_id, p_table, p_op, p_pk, p_payload_hash,
     p_error_code, p_error_text)
  RETURNING id INTO v_id;

  UPDATE public.sync_peer_health
     SET apply_errors_count = apply_errors_count + 1,
         last_error_code = p_error_code,
         last_error_text = p_error_text,
         updated_at = now()
   WHERE peer_link_id = p_peer_link_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.sync_resolve_apply_error(p_id bigint, p_resolution text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sync_apply_errors
     SET resolved_at = now(), resolution = p_resolution
   WHERE id = p_id;
$$;

-- 6c. Probe RPCs
CREATE OR REPLACE FUNCTION public.sync_record_probe_sent(
  p_peer_link_id uuid,
  p_direction text DEFAULT 'out'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.sync_probe_events (peer_link_id, direction)
  VALUES (p_peer_link_id, p_direction)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.sync_record_probe_ack(
  p_probe_id uuid,
  p_status text DEFAULT 'ok',
  p_error_text text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sent timestamptz; v_peer uuid; v_lat integer;
BEGIN
  SELECT sent_at, peer_link_id INTO v_sent, v_peer FROM public.sync_probe_events WHERE id = p_probe_id;
  IF v_sent IS NULL THEN RETURN; END IF;
  v_lat := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_sent)) * 1000)::int;
  UPDATE public.sync_probe_events
     SET ack_at = now(), status = p_status, latency_ms = v_lat, error_text = p_error_text
   WHERE id = p_probe_id;
  UPDATE public.sync_peer_health
     SET last_probe_at = now(), last_probe_latency_ms = v_lat, updated_at = now()
   WHERE peer_link_id = v_peer;
END $$;

-- 6d. Promote server to Primary (manager password verified in caller — here we just enforce super_admin)
CREATE OR REPLACE FUNCTION public.sync_promote_server(p_server_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cid uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;
  SELECT casino_id INTO v_cid FROM public.casino_servers WHERE id = p_server_id;
  IF v_cid IS NULL THEN RAISE EXCEPTION 'server not found'; END IF;
  UPDATE public.casino_servers SET role = 'replica' WHERE casino_id = v_cid AND role = 'primary';
  UPDATE public.casino_servers SET role = 'primary' WHERE id = p_server_id;
END $$;

-- 6e. Record snapshot import
CREATE OR REPLACE FUNCTION public.sync_record_snapshot(
  p_casino_id uuid,
  p_snapshot_id text,
  p_source text,
  p_source_created_at timestamptz,
  p_table_counts jsonb,
  p_checksum text
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.sync_snapshot_state
    (casino_id, snapshot_id, source, source_created_at, imported_at, table_counts, checksum)
  VALUES
    (p_casino_id, p_snapshot_id, p_source, p_source_created_at, now(), COALESCE(p_table_counts,'{}'::jsonb), p_checksum)
  ON CONFLICT (casino_id) DO UPDATE SET
    snapshot_id = EXCLUDED.snapshot_id,
    source = EXCLUDED.source,
    source_created_at = EXCLUDED.source_created_at,
    imported_at = EXCLUDED.imported_at,
    table_counts = EXCLUDED.table_counts,
    checksum = EXCLUDED.checksum;
$$;

-- 7. Retention: keep apply errors 90d, probes 30d
CREATE OR REPLACE FUNCTION public.sync_diagnostics_gc()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.sync_apply_errors WHERE last_seen_at < now() - interval '90 days';
  DELETE FROM public.sync_probe_events  WHERE sent_at      < now() - interval '30 days';
$$;

-- 8. Grants
REVOKE EXECUTE ON FUNCTION public.sync_record_health(uuid,text,timestamptz,integer,integer,text,text,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.sync_record_apply_error(uuid,bigint,text,text,jsonb,text,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.sync_record_probe_sent(uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.sync_record_probe_ack(uuid,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.sync_record_snapshot(uuid,text,text,timestamptz,jsonb,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_record_health(uuid,text,timestamptz,integer,integer,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_apply_error(uuid,bigint,text,text,jsonb,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_apply_ok(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_push_ok(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_pull_ok(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_probe_sent(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_probe_ack(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_record_snapshot(uuid,text,text,timestamptz,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_resolve_apply_error(bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_promote_server(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_diagnostics_gc() TO authenticated, service_role;

-- 9. Seed health rows for existing active peers so UI shows them immediately
INSERT INTO public.sync_peer_health (peer_link_id, peer_node_id, peer_name, state, updated_at)
SELECT id, peer_node_id, display_name,
       CASE WHEN status = 'active' THEN 'pairing' ELSE 'pairing' END,
       now()
  FROM public.peer_links
ON CONFLICT (peer_link_id) DO NOTHING;