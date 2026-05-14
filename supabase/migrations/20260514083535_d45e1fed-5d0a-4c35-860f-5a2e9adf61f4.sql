-- Phase 2.5: Extend Phase 2 to pit_rota + dealer_attendance

ALTER TABLE public.pit_rota          ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.dealer_attendance ADD COLUMN IF NOT EXISTS employee_id uuid;

CREATE INDEX IF NOT EXISTS idx_pit_rota_employee          ON public.pit_rota(casino_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_dealer_attendance_employee ON public.dealer_attendance(casino_id, employee_id, date);

UPDATE public.pit_rota          p SET employee_id = e.id FROM public.employees e WHERE e.dealer_id = p.dealer_id AND p.employee_id IS NULL;
UPDATE public.dealer_attendance d SET employee_id = e.id FROM public.employees e WHERE e.dealer_id = d.dealer_id AND d.employee_id IS NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.pit_rota          WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'pit_rota orphans %', n; END IF;
  SELECT count(*) INTO n FROM public.dealer_attendance WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'dealer_attendance orphans %', n; END IF;
END$$;

CREATE OR REPLACE FUNCTION public.pit_rota_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.dealer_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE dealer_id = NEW.dealer_id LIMIT 1;
  ELSIF NEW.dealer_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT dealer_id INTO NEW.dealer_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS trg_pit_rota_sync_employee_id ON public.pit_rota;
CREATE TRIGGER trg_pit_rota_sync_employee_id BEFORE INSERT OR UPDATE ON public.pit_rota
  FOR EACH ROW EXECUTE FUNCTION public.pit_rota_sync_employee_id();

CREATE OR REPLACE FUNCTION public.dealer_attendance_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.dealer_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE dealer_id = NEW.dealer_id LIMIT 1;
  ELSIF NEW.dealer_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT dealer_id INTO NEW.dealer_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS trg_dealer_attendance_sync_employee_id ON public.dealer_attendance;
CREATE TRIGGER trg_dealer_attendance_sync_employee_id BEFORE INSERT OR UPDATE ON public.dealer_attendance
  FOR EACH ROW EXECUTE FUNCTION public.dealer_attendance_sync_employee_id();

ALTER TABLE public.pit_rota
  ADD CONSTRAINT pit_rota_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;
ALTER TABLE public.dealer_attendance
  ADD CONSTRAINT dealer_attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;