CREATE OR REPLACE FUNCTION public.clear_future_breaklist_on_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.shift IN ('S', 'A') THEN
    DELETE FROM public.breaklist
    WHERE employee_id = NEW.employee_id
      AND date = NEW.date
      AND NOT is_locked;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_clear_breaklist_on_shift ON public.pit_rota;
DROP TRIGGER IF EXISTS clear_future_breaklist_on_shift_trigger ON public.pit_rota;
-- keep canonical: clear_future_breaklist_on_shift