
CREATE TABLE IF NOT EXISTS public.sync_probes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_casino_id uuid NOT NULL,
  origin_slug text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  echoed_at timestamptz,
  received_back_at timestamptz,
  latency_ms integer,
  status text NOT NULL DEFAULT 'sent',
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS sync_probes_sent_at_idx ON public.sync_probes (sent_at DESC);
CREATE INDEX IF NOT EXISTS sync_probes_origin_idx ON public.sync_probes (origin_casino_id, sent_at DESC);
ALTER TABLE public.sync_probes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_probes_super_admin_read"
  ON public.sync_probes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.peer_bootstrap_tokens (
  token text PRIMARY KEY,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_by_casino_id uuid,
  consumed_by_slug text
);
CREATE INDEX IF NOT EXISTS peer_bootstrap_tokens_unconsumed_idx
  ON public.peer_bootstrap_tokens (created_at DESC) WHERE consumed_at IS NULL;
ALTER TABLE public.peer_bootstrap_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_bootstrap_tokens_super_admin_all"
  ON public.peer_bootstrap_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.sync_roundtrip_probe(
  p_origin_casino_id uuid, p_origin_slug text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.sync_probes (origin_casino_id, origin_slug, status)
  VALUES (p_origin_casino_id, p_origin_slug, 'sent') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.sync_roundtrip_probe(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_roundtrip_probe(uuid, text) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('installer-snapshots', 'installer-snapshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "installer_snapshots_super_admin_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'installer-snapshots' AND public.has_role(auth.uid(), 'super_admin'));
