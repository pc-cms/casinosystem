CREATE OR REPLACE FUNCTION public.clear_breaklist_when_off_rota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DELETE rota row → free up all that dealer's slots for that day
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.breaklist
    WHERE casino_id   = OLD.casino_id
      AND date        = OLD.date
      AND employee_id = OLD.employee_id;
    RETURN OLD;
  END IF;

  -- UPDATE that re-targets the dealer/date/casino → clear the OLD pairing's slots
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.employee_id IS DISTINCT FROM NEW.employee_id)
       OR (OLD.date     IS DISTINCT FROM NEW.date)
       OR (OLD.casino_id IS DISTINCT FROM NEW.casino_id) THEN
      DELETE FROM public.breaklist
      WHERE casino_id   = OLD.casino_id
        AND date        = OLD.date
        AND employee_id = OLD.employee_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_breaklist_when_off_rota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clear_breaklist_when_off_rota ON public.pit_rota;
CREATE TRIGGER trg_clear_breaklist_when_off_rota
AFTER DELETE OR UPDATE ON public.pit_rota
FOR EACH ROW
EXECUTE FUNCTION public.clear_breaklist_when_off_rota();