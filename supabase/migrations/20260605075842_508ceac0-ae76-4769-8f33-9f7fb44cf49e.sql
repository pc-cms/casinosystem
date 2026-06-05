
-- Archive table mirrors fin_audit_log structure
CREATE TABLE IF NOT EXISTS public.fin_audit_log_archive (
  id uuid PRIMARY KEY,
  casino_id uuid,
  actor uuid,
  action text NOT NULL,
  entity_table text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fin_audit_log_archive TO authenticated;
GRANT ALL  ON public.fin_audit_log_archive TO service_role;

ALTER TABLE public.fin_audit_log_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view archived audit"
ON public.fin_audit_log_archive
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Archive function: move entries older than 2 years
CREATE OR REPLACE FUNCTION public.fin_archive_old_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.fin_audit_log
    WHERE created_at < now() - interval '2 years'
    RETURNING *
  )
  INSERT INTO public.fin_audit_log_archive
    (id, casino_id, actor, action, entity_table, entity_id, meta, created_at)
  SELECT id, casino_id, actor, action, entity_table, entity_id, meta, created_at
  FROM moved;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule monthly at 03:00 UTC on day 1
DO $$
BEGIN
  PERFORM cron.unschedule('fin_audit_log_archive_monthly');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'fin_audit_log_archive_monthly',
  '0 3 1 * *',
  $$SELECT public.fin_archive_old_audit_log();$$
);
