
-- Lock down clear_stale_peer_links: only authenticated users; pin search_path
REVOKE EXECUTE ON FUNCTION public.clear_stale_peer_links() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_stale_peer_links() TO authenticated;

ALTER FUNCTION public.clear_stale_peer_links() SET search_path = public;
ALTER FUNCTION public.touch_peer_links() SET search_path = public;
