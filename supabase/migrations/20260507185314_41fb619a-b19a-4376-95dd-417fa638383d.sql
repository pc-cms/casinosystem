-- 1. Audit log table
CREATE TABLE IF NOT EXISTS public.incidents_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL,
  edited_by uuid,
  edited_at timestamptz NOT NULL DEFAULT now(),
  changes jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_audit_incident ON public.incidents_audit(incident_id);
CREATE INDEX IF NOT EXISTS idx_incidents_audit_casino_date ON public.incidents_audit(casino_id, edited_at DESC);

ALTER TABLE public.incidents_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_audit_select_casino" ON public.incidents_audit;
CREATE POLICY "incidents_audit_select_casino" ON public.incidents_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_casino_access uca
      WHERE uca.user_id = auth.uid() AND uca.casino_id = incidents_audit.casino_id
    )
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_manager')
  );

-- Inserts only by the trigger (no client writes).
DROP POLICY IF EXISTS "incidents_audit_no_client_write" ON public.incidents_audit;
CREATE POLICY "incidents_audit_no_client_write" ON public.incidents_audit
  FOR INSERT TO authenticated WITH CHECK (false);

-- 2. Replace the field-lock trigger with an audit trigger.
DROP TRIGGER IF EXISTS trg_incidents_lock_immutable_fields ON public.incidents;
DROP FUNCTION IF EXISTS public.incidents_lock_immutable_fields() CASCADE;

CREATE OR REPLACE FUNCTION public.incidents_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff jsonb := '{}'::jsonb;
  col text;
  old_val text;
  new_val text;
BEGIN
  -- Compare every column except system/identity columns.
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents'
      AND column_name NOT IN ('id','casino_id','created_by','created_at')
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col)
      INTO old_val, new_val USING OLD, NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      diff := diff || jsonb_build_object(col, jsonb_build_object('old', old_val, 'new', new_val));
    END IF;
  END LOOP;

  IF diff <> '{}'::jsonb THEN
    INSERT INTO public.incidents_audit (incident_id, casino_id, edited_by, changes)
    VALUES (NEW.id, NEW.casino_id, auth.uid(), diff);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incidents_log_changes
  AFTER UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incidents_log_changes();

-- 3. Block deletes (immutability).
CREATE OR REPLACE FUNCTION public.incidents_block_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'incidents are immutable: deletes are not allowed';
END;
$$;
DROP TRIGGER IF EXISTS trg_incidents_block_delete ON public.incidents;
CREATE TRIGGER trg_incidents_block_delete
  BEFORE DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incidents_block_delete();
