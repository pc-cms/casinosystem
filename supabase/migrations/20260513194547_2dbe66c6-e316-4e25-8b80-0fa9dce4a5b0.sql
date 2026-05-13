
-- Trigger function to populate table_daily_results after a cage shift closes
CREATE OR REPLACE FUNCTION public.trg_populate_daily_results_on_shift_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    -- Business date of the shift: opened_at in EAT, minus 5h rollover
    v_date := ((NEW.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '5 hours')::date;
    PERFORM public.populate_table_daily_results_for_day(NEW.casino_id, v_date, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_daily_results_on_shift_close ON public.shifts;
CREATE TRIGGER trg_populate_daily_results_on_shift_close
AFTER UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_populate_daily_results_on_shift_close();

-- Trigger function to populate after business day closure (safety net)
CREATE OR REPLACE FUNCTION public.trg_populate_daily_results_on_bday_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.populate_table_daily_results_for_day(NEW.casino_id, NEW.business_date, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_daily_results_on_bday_close ON public.business_day_closures;
CREATE TRIGGER trg_populate_daily_results_on_bday_close
AFTER INSERT ON public.business_day_closures
FOR EACH ROW EXECUTE FUNCTION public.trg_populate_daily_results_on_bday_close();

-- Backfill last 30 days for all casinos (idempotent UPSERT inside the function)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT casino_id, business_date
    FROM public.business_day_closures
    WHERE business_date >= (CURRENT_DATE - interval '30 days')::date
  LOOP
    PERFORM public.populate_table_daily_results_for_day(r.casino_id, r.business_date, NULL);
  END LOOP;
END $$;
