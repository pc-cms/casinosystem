
-- ============================================================================
-- Peer Mesh foundation: drop legacy registration tables, create symmetric peer model.
-- Every node (local or Cloud) is identical. No primary/replica, no hub.
-- ============================================================================

-- 1. Drop legacy hub/spoke tables (test data only, per "переписываем с нуля")
DROP TABLE IF EXISTS public.peer_links CASCADE;
DROP TABLE IF EXISTS public.pending_server_registrations CASCADE;
DROP TABLE IF EXISTS public.local_servers CASCADE;

-- 2. node_identity: WHO AM I. Exactly one row per database.
CREATE TABLE public.node_identity (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- singleton lock
  node_id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT 'unnamed-node',
  node_kind text NOT NULL DEFAULT 'local' CHECK (node_kind IN ('local','cloud')),
  schema_version text NOT NULL DEFAULT '0.0.0',
  owned_casino_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.node_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "node_identity readable to authenticated"
  ON public.node_identity FOR SELECT TO authenticated USING (true);
CREATE POLICY "node_identity writable to super_admin"
  ON public.node_identity FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed singleton row
INSERT INTO public.node_identity (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 3. peer_links: WHO ARE MY PEERS. Symmetric. No is_primary.
CREATE TABLE public.peer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_url text NOT NULL,
  peer_node_id uuid,                  -- learned during handshake
  display_name text NOT NULL,
  sync_secret text NOT NULL,          -- 32-byte hex, shared with peer
  status text NOT NULL DEFAULT 'pending_outbound'
    CHECK (status IN ('pending_outbound','pending_inbound','active','paused','rejected')),
  schema_version text,                -- last seen peer schema version
  last_seen_at timestamptz,
  last_push_cursor bigint NOT NULL DEFAULT 0,
  last_pull_cursor bigint NOT NULL DEFAULT 0,
  last_push_error text,
  last_pull_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peer_node_id)
);

CREATE INDEX peer_links_status_idx ON public.peer_links (status);
CREATE INDEX peer_links_last_seen_idx ON public.peer_links (last_seen_at DESC);

ALTER TABLE public.peer_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_links readable to authenticated"
  ON public.peer_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "peer_links writable to super_admin"
  ON public.peer_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Touch trigger
CREATE OR REPLACE FUNCTION public.touch_peer_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_peer_links_touch
  BEFORE UPDATE ON public.peer_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_peer_links();

CREATE TRIGGER trg_node_identity_touch
  BEFORE UPDATE ON public.node_identity
  FOR EACH ROW EXECUTE FUNCTION public.touch_peer_links();

-- 5. RPC: clear stale pending peers (button in UI)
CREATE OR REPLACE FUNCTION public.clear_stale_peer_links()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.peer_links
  WHERE status IN ('pending_outbound','pending_inbound','rejected')
    AND created_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_stale_peer_links() TO authenticated;
