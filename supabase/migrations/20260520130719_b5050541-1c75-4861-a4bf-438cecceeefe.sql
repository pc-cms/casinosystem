
-- On-prem channels: registry of physical on-premise servers connected to Cloud
-- via Cloudflare Tunnel. Used by Lovable agent + Admin UI to push migrations,
-- run read-only queries, trigger updates, and monitor health remotely.

CREATE TABLE public.onprem_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  slug text NOT NULL UNIQUE,                  -- mwz / aru / dod / mbi
  tunnel_hostname text NOT NULL,              -- e.g. mwz.casinosystem.app
  cf_tunnel_id text,                          -- Cloudflare tunnel UUID (informational)
  hmac_secret_hash text NOT NULL,             -- SHA-256 hex of the HMAC secret
  pairing_code text,                          -- one-shot 8-digit code printed by install.sh
  pairing_expires_at timestamptz,
  paired_at timestamptz,
  paired_by uuid REFERENCES auth.users(id),
  last_seen_at timestamptz,
  version text,
  outbox_lag int,
  status text NOT NULL DEFAULT 'pending',     -- pending | online | offline | disabled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onprem_channels_status ON public.onprem_channels(status);
CREATE INDEX idx_onprem_channels_casino ON public.onprem_channels(casino_id);

ALTER TABLE public.onprem_channels ENABLE ROW LEVEL SECURITY;

-- Super admin: full control. Finance manager + manager: read-only for monitoring.
CREATE POLICY "super_admin_manages_onprem_channels"
ON public.onprem_channels
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "fm_manager_view_onprem_channels"
ON public.onprem_channels
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'finance_manager')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'surveillance')
);

-- updated_at trigger (reuse existing helper)
CREATE TRIGGER update_onprem_channels_updated_at
BEFORE UPDATE ON public.onprem_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Local migration ledger mirror on Cloud side — not authoritative, just a registry
-- of what migrations the agent has pushed to each channel (so we can see drift
-- without HTTP-calling the box).
CREATE TABLE public.onprem_channel_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.onprem_channels(id) ON DELETE CASCADE,
  version text NOT NULL,
  sql_hash text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  error text,
  UNIQUE(channel_id, version)
);

ALTER TABLE public.onprem_channel_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manages_onprem_migrations"
ON public.onprem_channel_migrations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
