-- ============================================================
-- cloud_connection — single-row table on the LOCAL on-prem database
-- to remember pairing state with the central Cloud server.
-- (Harmless if applied to Cloud — Cloud just never reads this row.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cloud_connection (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cloud_url     text,
  status        text NOT NULL DEFAULT 'disconnected'
                 CHECK (status IN ('disconnected','pairing','connected')),
  pairing_id    uuid,
  pairing_code  text,
  pairing_expires_at timestamptz,
  casino_id     uuid,
  sync_secret   text,
  connected_at  timestamptz,
  last_polled_at timestamptz,
  last_error    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Always have the singleton row available
INSERT INTO public.cloud_connection (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.cloud_connection_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cloud_connection_touch ON public.cloud_connection;
CREATE TRIGGER trg_cloud_connection_touch
  BEFORE UPDATE ON public.cloud_connection
  FOR EACH ROW EXECUTE FUNCTION public.cloud_connection_touch();

-- RLS — super_admin only
ALTER TABLE public.cloud_connection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin reads cloud_connection" ON public.cloud_connection;
CREATE POLICY "super_admin reads cloud_connection"
  ON public.cloud_connection FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin writes cloud_connection" ON public.cloud_connection;
CREATE POLICY "super_admin writes cloud_connection"
  ON public.cloud_connection FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));