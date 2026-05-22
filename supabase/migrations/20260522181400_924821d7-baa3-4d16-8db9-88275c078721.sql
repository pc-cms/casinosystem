CREATE OR REPLACE FUNCTION public.clear_breaklist_when_off_rota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_closed boolean;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.business_day_closures
      WHERE casino_id = OLD.casino_id AND business_date = OLD.date
    ) INTO _is_closed;
    IF _is_closed THEN
      RETURN OLD;
    END IF;
    DELETE FROM public.breaklist
    WHERE casino_id   = OLD.casino_id
      AND date        = OLD.date
      AND employee_id = OLD.employee_id;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.employee_id IS DISTINCT FROM NEW.employee_id)
       OR (OLD.date     IS DISTINCT FROM NEW.date)
       OR (OLD.casino_id IS DISTINCT FROM NEW.casino_id) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.business_day_closures
        WHERE casino_id = OLD.casino_id AND business_date = OLD.date
      ) INTO _is_closed;
      IF _is_closed THEN
        RETURN NEW;
      END IF;
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