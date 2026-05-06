
-- Allow limited post-creation edits on incidents (outcome, points, comments).
CREATE POLICY "incidents_update_followup"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'surveillance'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'surveillance'::app_role)
);

-- Trigger: lock every column except outcome/points/comments (and updated_at if present).
CREATE OR REPLACE FUNCTION public.incidents_lock_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.casino_id        IS DISTINCT FROM OLD.casino_id        THEN RAISE EXCEPTION 'casino_id is immutable'; END IF;
  IF NEW.incident_date    IS DISTINCT FROM OLD.incident_date    THEN RAISE EXCEPTION 'incident_date is immutable'; END IF;
  IF NEW.incident_time    IS DISTINCT FROM OLD.incident_time    THEN RAISE EXCEPTION 'incident_time is immutable'; END IF;
  IF NEW.cctv_observer    IS DISTINCT FROM OLD.cctv_observer    THEN RAISE EXCEPTION 'cctv_observer is immutable'; END IF;
  IF NEW.manager          IS DISTINCT FROM OLD.manager          THEN RAISE EXCEPTION 'manager is immutable'; END IF;
  IF NEW.department       IS DISTINCT FROM OLD.department       THEN RAISE EXCEPTION 'department is immutable'; END IF;
  IF NEW.employees        IS DISTINCT FROM OLD.employees        THEN RAISE EXCEPTION 'employees is immutable'; END IF;
  IF NEW.table_name       IS DISTINCT FROM OLD.table_name       THEN RAISE EXCEPTION 'table_name is immutable'; END IF;
  IF NEW.dealer_name      IS DISTINCT FROM OLD.dealer_name      THEN RAISE EXCEPTION 'dealer_name is immutable'; END IF;
  IF NEW.inspector_name   IS DISTINCT FROM OLD.inspector_name   THEN RAISE EXCEPTION 'inspector_name is immutable'; END IF;
  IF NEW.violation_type   IS DISTINCT FROM OLD.violation_type   THEN RAISE EXCEPTION 'violation_type is immutable'; END IF;
  IF NEW.incident         IS DISTINCT FROM OLD.incident         THEN RAISE EXCEPTION 'incident is immutable'; END IF;
  IF NEW.photo_url        IS DISTINCT FROM OLD.photo_url        THEN RAISE EXCEPTION 'photo_url is immutable'; END IF;
  IF NEW.created_by       IS DISTINCT FROM OLD.created_by       THEN RAISE EXCEPTION 'created_by is immutable'; END IF;
  IF NEW.created_at       IS DISTINCT FROM OLD.created_at       THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incidents_lock_immutable_fields ON public.incidents;
CREATE TRIGGER trg_incidents_lock_immutable_fields
BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.incidents_lock_immutable_fields();
