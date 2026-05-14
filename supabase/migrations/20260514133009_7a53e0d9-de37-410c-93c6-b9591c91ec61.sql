
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  text NOT NULL DEFAULT '';

-- Backfill: dump existing full_name into last_name, leave first_name empty.
-- Manager will manually split each row via the Staff Master UI.
UPDATE public.employees
SET last_name = full_name
WHERE last_name = '' AND first_name = '' AND coalesce(full_name,'') <> '';

-- Trigger: keep full_name in sync with first_name + last_name.
-- If a legacy writer changes full_name without touching parts → put it into last_name.
CREATE OR REPLACE FUNCTION public.employees_sync_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_first text := btrim(coalesce(NEW.first_name, ''));
  v_last  text := btrim(coalesce(NEW.last_name, ''));
  v_full  text := btrim(coalesce(NEW.full_name, ''));
  v_old_full text := CASE WHEN TG_OP = 'UPDATE' THEN btrim(coalesce(OLD.full_name,'')) ELSE '' END;
  v_old_first text := CASE WHEN TG_OP = 'UPDATE' THEN btrim(coalesce(OLD.first_name,'')) ELSE '' END;
  v_old_last  text := CASE WHEN TG_OP = 'UPDATE' THEN btrim(coalesce(OLD.last_name,'')) ELSE '' END;
BEGIN
  -- Case A: caller updated full_name only (legacy path) → store into last_name.
  IF TG_OP = 'UPDATE'
     AND v_full <> v_old_full
     AND v_first = v_old_first
     AND v_last  = v_old_last
  THEN
    NEW.last_name := v_full;
    NEW.first_name := '';
    NEW.full_name := v_full;
    RETURN NEW;
  END IF;

  -- Case B: parts present → rebuild full_name.
  IF v_first <> '' OR v_last <> '' THEN
    NEW.first_name := v_first;
    NEW.last_name  := v_last;
    NEW.full_name  := btrim(v_first || ' ' || v_last);
  ELSIF v_full <> '' THEN
    -- Insert with only full_name → seed last_name.
    NEW.last_name := v_full;
    NEW.first_name := '';
    NEW.full_name := v_full;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_sync_name ON public.employees;
CREATE TRIGGER trg_employees_sync_name
BEFORE INSERT OR UPDATE OF first_name, last_name, full_name ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_sync_name();
