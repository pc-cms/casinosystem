-- Guard: archived tables must never be in 'open' status.
CREATE OR REPLACE FUNCTION public.gaming_tables_archive_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If a table is archived, force-close it.
  IF NEW.is_archived = true AND NEW.status = 'open' THEN
    NEW.status := 'closed';
    IF NEW.closing_result IS NULL THEN
      NEW.closing_result := 0;
    END IF;
    IF NEW.closing_chips IS NULL THEN
      NEW.closing_chips := '{}'::jsonb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gaming_tables_archive_guard ON public.gaming_tables;
CREATE TRIGGER trg_gaming_tables_archive_guard
BEFORE INSERT OR UPDATE ON public.gaming_tables
FOR EACH ROW
EXECUTE FUNCTION public.gaming_tables_archive_guard();