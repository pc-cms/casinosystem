-- Sprint A part 2: Premier-hub role-aware fan-out
-- Track each peer's node_kind so the sync engine can filter by sync_role.

ALTER TABLE public.peer_links
  ADD COLUMN IF NOT EXISTS peer_node_kind text;

ALTER TABLE public.peer_links
  DROP CONSTRAINT IF EXISTS peer_links_peer_node_kind_check;

ALTER TABLE public.peer_links
  ADD CONSTRAINT peer_links_peer_node_kind_check
  CHECK (peer_node_kind IS NULL OR peer_node_kind IN ('local','cloud'));

CREATE INDEX IF NOT EXISTS idx_peer_links_kind ON public.peer_links(peer_node_kind);