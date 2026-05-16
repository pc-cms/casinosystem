
-- 1. Rename casinos to "<City> Cloud"
UPDATE public.casinos SET name = 'Arusha Cloud' WHERE slug = 'arusha';
UPDATE public.casinos SET name = 'Dodoma Cloud' WHERE slug = 'dodoma';
UPDATE public.casinos SET name = 'Mwanza Cloud' WHERE slug = 'mwanza';
UPDATE public.casinos SET name = 'Mbeya Cloud'  WHERE slug = 'mbeya';

-- 2. Sync exchange log (Cloud-side audit of what local nodes pull/push)
CREATE TABLE IF NOT EXISTS public.sync_exchange_logs (
  id           bigserial PRIMARY KEY,
  peer_link_id uuid REFERENCES public.peer_links(id) ON DELETE SET NULL,
  peer_node_id uuid,
  peer_name    text,
  direction    text NOT NULL CHECK (direction IN ('pull','push','clone','heartbeat','handshake')),
  status       text NOT NULL CHECK (status IN ('ok','warn','error')),
  table_name   text,
  row_count    integer DEFAULT 0,
  batch_id     text,
  error_text   text,
  meta         jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_exchange_logs_created
  ON public.sync_exchange_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_exchange_logs_peer_created
  ON public.sync_exchange_logs (peer_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_exchange_logs_status
  ON public.sync_exchange_logs (status, created_at DESC) WHERE status <> 'ok';

ALTER TABLE public.sync_exchange_logs ENABLE ROW LEVEL SECURITY;

-- Read: super_admin & finance_manager
DROP POLICY IF EXISTS "Admins read sync exchange logs" ON public.sync_exchange_logs;
CREATE POLICY "Admins read sync exchange logs"
  ON public.sync_exchange_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- Insert: service role only (edge functions). No INSERT policy for authenticated users.

-- Retention: keep 30 days
CREATE OR REPLACE FUNCTION public.sync_exchange_logs_gc()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.sync_exchange_logs
   WHERE created_at < now() - interval '30 days';
$$;
