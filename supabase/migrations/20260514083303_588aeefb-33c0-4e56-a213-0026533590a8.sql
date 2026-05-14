-- Phase 2: Backfill + dual-write triggers + FK

-- 1. Backfill
UPDATE public.breaklist b SET employee_id = e.id
  FROM public.employees e WHERE e.dealer_id = b.dealer_id AND b.employee_id IS NULL;

UPDATE public.staff_rota r SET employee_id = e.id
  FROM public.employees e WHERE e.staff_member_id = r.staff_id AND r.employee_id IS NULL;

UPDATE public.staff_attendance a SET employee_id = e.id
  FROM public.employees e WHERE e.staff_member_id = a.staff_id AND a.employee_id IS NULL;

-- 2. Verify (will RAISE and rollback if any orphan)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.breaklist        WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'breaklist has % orphans', n; END IF;
  SELECT count(*) INTO n FROM public.staff_rota       WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'staff_rota has % orphans', n; END IF;
  SELECT count(*) INTO n FROM public.staff_attendance WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'staff_attendance has % orphans', n; END IF;
END$$;

-- 3. Dual-write triggers — keep dealer_id/staff_id and employee_id mutually consistent

CREATE OR REPLACE FUNCTION public.breaklist_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.dealer_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE dealer_id = NEW.dealer_id LIMIT 1;
  ELSIF NEW.dealer_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT dealer_id INTO NEW.dealer_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_breaklist_sync_employee_id ON public.breaklist;
CREATE TRIGGER trg_breaklist_sync_employee_id BEFORE INSERT OR UPDATE ON public.breaklist
  FOR EACH ROW EXECUTE FUNCTION public.breaklist_sync_employee_id();

CREATE OR REPLACE FUNCTION public.staff_rota_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.staff_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE staff_member_id = NEW.staff_id LIMIT 1;
  ELSIF NEW.staff_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT staff_member_id INTO NEW.staff_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_staff_rota_sync_employee_id ON public.staff_rota;
CREATE TRIGGER trg_staff_rota_sync_employee_id BEFORE INSERT OR UPDATE ON public.staff_rota
  FOR EACH ROW EXECUTE FUNCTION public.staff_rota_sync_employee_id();

CREATE OR REPLACE FUNCTION public.staff_attendance_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.staff_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE staff_member_id = NEW.staff_id LIMIT 1;
  ELSIF NEW.staff_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT staff_member_id INTO NEW.staff_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_staff_attendance_sync_employee_id ON public.staff_attendance;
CREATE TRIGGER trg_staff_attendance_sync_employee_id BEFORE INSERT OR UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.staff_attendance_sync_employee_id();

-- 4. Real FKs (RESTRICT delete)
ALTER TABLE public.breaklist
  ADD CONSTRAINT breaklist_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_rota
  ADD CONSTRAINT staff_rota_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_attendance
  ADD CONSTRAINT staff_attendance_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;