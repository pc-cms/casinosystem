
-- 1. Backfill local_servers from the latest approved/consumed pairing per casino
INSERT INTO public.local_servers (casino_id, server_ip, server_name, is_online, sync_secret, linked_by, linked_at)
SELECT DISTINCT ON (p.approved_casino_id)
  p.approved_casino_id,
  COALESCE(p.server_ip, '0.0.0.0'),
  p.server_name,
  false,
  p.sync_secret,
  COALESCE(p.approved_by, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(p.approved_at, now())
FROM public.pending_server_registrations p
WHERE p.status IN ('approved','consumed')
  AND p.approved_casino_id IS NOT NULL
  AND p.sync_secret IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.local_servers ls WHERE ls.casino_id = p.approved_casino_id)
ORDER BY p.approved_casino_id, p.approved_at DESC NULLS LAST, p.created_at DESC;

-- 2. Delete old pairing entries
DELETE FROM public.pending_server_registrations
WHERE status IN ('consumed','expired','rejected')
   OR (status = 'pending' AND created_at < now() - interval '30 minutes');
