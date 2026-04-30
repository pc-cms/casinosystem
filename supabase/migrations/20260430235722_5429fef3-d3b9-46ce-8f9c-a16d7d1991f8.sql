
-- Views: enable security_invoker so RLS of the underlying tables applies to the caller
ALTER VIEW public.player_session_stats   SET (security_invoker = true);
ALTER VIEW public.sessions_total_bet_sum SET (security_invoker = true);
ALTER VIEW public.player_session_drops   SET (security_invoker = true);
ALTER VIEW public.sync_outbox_pending    SET (security_invoker = true);
ALTER VIEW public.cron_recent_runs       SET (security_invoker = true);

-- Pin search_path on legacy functions
ALTER FUNCTION public.sync_attach(regclass)    SET search_path = public;
ALTER FUNCTION public.sync_outbox_gc()         SET search_path = public;
