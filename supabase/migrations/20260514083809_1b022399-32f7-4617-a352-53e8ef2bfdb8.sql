ALTER TABLE public.weekly_bonus_entries ADD COLUMN IF NOT EXISTS employee_id uuid;
CREATE INDEX IF NOT EXISTS idx_weekly_bonus_employee ON public.weekly_bonus_entries(casino_id, employee_id, week_start);

UPDATE public.weekly_bonus_entries w SET employee_id = e.id FROM public.employees e WHERE e.dealer_id = w.dealer_id AND w.employee_id IS NULL;

DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.weekly_bonus_entries WHERE employee_id IS NULL; IF n>0 THEN RAISE EXCEPTION 'weekly_bonus orphans %', n; END IF; END$$;

CREATE OR REPLACE FUNCTION public.weekly_bonus_sync_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.dealer_id IS NOT NULL THEN
    SELECT id INTO NEW.employee_id FROM public.employees WHERE dealer_id = NEW.dealer_id LIMIT 1;
  ELSIF NEW.dealer_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT dealer_id INTO NEW.dealer_id FROM public.employees WHERE id = NEW.employee_id LIMIT 1;
  END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS trg_weekly_bonus_sync_employee_id ON public.weekly_bonus_entries;
CREATE TRIGGER trg_weekly_bonus_sync_employee_id BEFORE INSERT OR UPDATE ON public.weekly_bonus_entries
  FOR EACH ROW EXECUTE FUNCTION public.weekly_bonus_sync_employee_id();

ALTER TABLE public.weekly_bonus_entries
  ADD CONSTRAINT weekly_bonus_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;