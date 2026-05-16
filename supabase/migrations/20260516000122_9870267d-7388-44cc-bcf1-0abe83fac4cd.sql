-- Cloud-only cleanup (the `sync` schema lives in the on-prem DB, not here).

UPDATE public.pending_server_registrations p
   SET status = 'consumed'
  FROM public.local_servers ls
 WHERE p.status = 'approved'
   AND p.approved_casino_id = ls.casino_id;

DELETE FROM public.pending_server_registrations
 WHERE status IN ('consumed','rejected','expired')
   AND COALESCE(approved_at, created_at) < now() - interval '7 days';

CREATE OR REPLACE FUNCTION public.gc_pending_server_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_server_registrations
     SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < now();

  UPDATE public.pending_server_registrations p
     SET status = 'consumed'
    FROM public.local_servers ls
   WHERE p.status = 'approved'
     AND p.approved_casino_id = ls.casino_id;

  DELETE FROM public.pending_server_registrations
   WHERE status IN ('consumed','rejected','expired')
     AND COALESCE(approved_at, created_at) < now() - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.gc_pending_server_registrations() FROM PUBLIC, anon, authenticated;