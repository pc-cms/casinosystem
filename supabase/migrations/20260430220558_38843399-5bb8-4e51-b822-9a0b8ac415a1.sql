ALTER TABLE public.local_servers
  ADD COLUMN IF NOT EXISTS health_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS health_updated_at TIMESTAMPTZ;