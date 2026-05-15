
CREATE TABLE IF NOT EXISTS public.pending_server_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_code text UNIQUE NOT NULL,
  server_name text NOT NULL,
  server_slug text,
  server_ip text,
  hostname text,
  system_info jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','consumed')),
  approved_casino_id uuid REFERENCES public.casinos(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_reason text,
  sync_secret text,
  seed_token text,
  seed_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_psr_status ON public.pending_server_registrations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_psr_pairing_code ON public.pending_server_registrations(pairing_code);

ALTER TABLE public.pending_server_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read pending servers"
  ON public.pending_server_registrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins update pending servers"
  ON public.pending_server_registrations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_psr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_psr_updated_at ON public.pending_server_registrations;
CREATE TRIGGER trg_psr_updated_at
  BEFORE UPDATE ON public.pending_server_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_psr_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_server_registrations;
