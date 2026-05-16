-- ─── M1: peer_links — unified pairing table for cloud↔local and local↔local ───
CREATE TABLE IF NOT EXISTS public.peer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  peer_kind text NOT NULL CHECK (peer_kind IN ('cloud','local')),
  is_primary boolean NOT NULL DEFAULT false,
  sync_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  casino_id uuid REFERENCES public.casinos(id) ON DELETE CASCADE,
  sync_status text NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle','seeding','active','error')),
  last_seen_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS peer_links_target_casino_uniq
  ON public.peer_links (target_url, COALESCE(casino_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.peer_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage peer links"
  ON public.peer_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Finance managers view peer links"
  ON public.peer_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_manager'::app_role));

-- Backfill from local_servers so the new UI is not empty after deploy.
INSERT INTO public.peer_links (
  target_url, display_name, peer_kind, is_primary,
  sync_secret, casino_id, sync_status, last_seen_at, created_at, created_by
)
SELECT
  COALESCE('https://' || NULLIF(ls.server_ip, ''), 'https://unknown'),
  COALESCE(NULLIF(ls.server_name, ''), 'Local server'),
  'local',
  false,                       -- cloud side keeps replica role; admin can flip later
  ls.sync_secret,
  ls.casino_id,
  CASE WHEN ls.is_online THEN 'active' ELSE 'idle' END,
  ls.last_sync_at,
  ls.linked_at,
  ls.linked_by
FROM public.local_servers ls
ON CONFLICT DO NOTHING;

-- Cleanup helper used by the "Clear stale pairings" admin button.
CREATE OR REPLACE FUNCTION public.clear_stale_peer_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super_admin can clear stale pairings';
  END IF;

  -- Drop pending_server_registrations older than 30 min or in terminal status.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='pending_server_registrations') THEN
    EXECUTE $sql$
      DELETE FROM public.pending_server_registrations
      WHERE status IN ('rejected','expired','consumed')
         OR (status = 'pending' AND created_at < now() - interval '30 minutes')
    $sql$;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- Also remove peer_links stuck in error > 24h with no recent contact.
  DELETE FROM public.peer_links
   WHERE sync_status = 'error'
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '24 hours');

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.clear_stale_peer_requests() FROM public;
GRANT EXECUTE ON FUNCTION public.clear_stale_peer_requests() TO authenticated;

-- Realtime so admin UI updates live.
ALTER TABLE public.peer_links REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='peer_links';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_links';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;