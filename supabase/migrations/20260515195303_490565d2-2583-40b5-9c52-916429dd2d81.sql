CREATE TABLE IF NOT EXISTS public.initial_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  local_server_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','cancelled')),
  tables_total int NOT NULL DEFAULT 0,
  tables_done int NOT NULL DEFAULT 0,
  rows_total bigint NOT NULL DEFAULT 0,
  rows_done bigint NOT NULL DEFAULT 0,
  current_table text,
  error text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_initial_sync_jobs_casino_status ON public.initial_sync_jobs(casino_id, status);
CREATE INDEX IF NOT EXISTS idx_initial_sync_jobs_server ON public.initial_sync_jobs(local_server_id, created_at DESC);

ALTER TABLE public.initial_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin reads sync jobs" ON public.initial_sync_jobs;
CREATE POLICY "super_admin reads sync jobs"
  ON public.initial_sync_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin inserts sync jobs" ON public.initial_sync_jobs;
CREATE POLICY "super_admin inserts sync jobs"
  ON public.initial_sync_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin updates sync jobs" ON public.initial_sync_jobs;
CREATE POLICY "super_admin updates sync jobs"
  ON public.initial_sync_jobs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_initial_sync_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initial_sync_jobs_updated ON public.initial_sync_jobs;
CREATE TRIGGER trg_initial_sync_jobs_updated
  BEFORE UPDATE ON public.initial_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_initial_sync_jobs_updated_at();