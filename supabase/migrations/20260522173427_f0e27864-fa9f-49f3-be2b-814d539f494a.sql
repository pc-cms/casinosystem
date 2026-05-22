CREATE OR REPLACE FUNCTION public.enforce_employee_same_casino()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND e.casino_id = NEW.casino_id
  ) THEN
    RAISE EXCEPTION 'Employee belongs to another casino';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_breaklist_same_casino()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND e.casino_id = NEW.casino_id
  ) THEN
    RAISE EXCEPTION 'Dealer belongs to another casino';
  END IF;

  IF NEW.table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.gaming_tables t
    WHERE t.id = NEW.table_id
      AND t.casino_id = NEW.casino_id
  ) THEN
    RAISE EXCEPTION 'Table belongs to another casino';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_breaklist_same_casino ON public.breaklist;
CREATE TRIGGER enforce_breaklist_same_casino
  BEFORE INSERT OR UPDATE ON public.breaklist
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_breaklist_same_casino();

DROP TRIGGER IF EXISTS enforce_pit_rota_employee_same_casino ON public.pit_rota;
CREATE TRIGGER enforce_pit_rota_employee_same_casino
  BEFORE INSERT OR UPDATE ON public.pit_rota
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_same_casino();

DROP TRIGGER IF EXISTS enforce_dealer_attendance_employee_same_casino ON public.dealer_attendance;
CREATE TRIGGER enforce_dealer_attendance_employee_same_casino
  BEFORE INSERT OR UPDATE ON public.dealer_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_same_casino();