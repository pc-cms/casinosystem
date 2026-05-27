
CREATE TABLE public.endpoint_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','fail')),
  http_code int,
  duration_ms int,
  error text
);

CREATE INDEX idx_endpoint_health_checks_checked_at
  ON public.endpoint_health_checks (checked_at DESC);
CREATE INDEX idx_endpoint_health_checks_status
  ON public.endpoint_health_checks (status, checked_at DESC)
  WHERE status = 'fail';

GRANT SELECT ON public.endpoint_health_checks TO authenticated;
GRANT ALL ON public.endpoint_health_checks TO service_role;

ALTER TABLE public.endpoint_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin reads health checks"
  ON public.endpoint_health_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Auto-purge rows older than 30 days
CREATE OR REPLACE FUNCTION public.purge_endpoint_health_checks()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.endpoint_health_checks WHERE checked_at < now() - interval '30 days';
$$;
