-- After a business day is closed and daily results are archived,
-- reset transient per-shift state on gaming_tables so the new business
-- day starts with empty closing_result / closing_chips. Without this,
-- yesterday's CLOSED tables keep displaying their result on today's
-- Tables Tracking dashboard.

CREATE OR REPLACE FUNCTION public.trg_populate_daily_results_on_bday_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.populate_table_daily_results_for_day(NEW.casino_id, NEW.business_date, NULL);

  -- Clear transient closing state from gaming_tables for this casino.
  -- The per-day numbers are already archived into table_daily_results /
  -- snapshots / shifts; gaming_tables only holds the LIVE current shift
  -- state. Tables remain status='closed' until pit opens them again.
  UPDATE public.gaming_tables
     SET closing_result = NULL,
         closing_chips  = NULL
   WHERE casino_id = NEW.casino_id
     AND (closing_result IS NOT NULL OR closing_chips IS NOT NULL);

  RETURN NEW;
END;
$function$;

-- One-time cleanup for casinos whose latest business day is already
-- closed but still carries stale closing_result on gaming_tables.
UPDATE public.gaming_tables gt
   SET closing_result = NULL,
       closing_chips  = NULL
  FROM (
    SELECT DISTINCT ON (casino_id) casino_id, business_date
      FROM public.business_day_closures
     ORDER BY casino_id, business_date DESC
  ) latest
 WHERE gt.casino_id = latest.casino_id
   AND latest.business_date = (
     SELECT MAX(business_date)
       FROM public.business_day_closures
      WHERE casino_id = gt.casino_id
   )
   AND (gt.closing_result IS NOT NULL OR gt.closing_chips IS NOT NULL);
