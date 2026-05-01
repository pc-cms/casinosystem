-- One-shot cleanup: close all guest visits left open from previous business days.
-- The cron job public.auto_close_business_day will keep this clean every night
-- at 05:00 EAT going forward; this catches the backlog from before the cron was
-- scheduled.

UPDATE public.casino_visits
   SET checked_out_at = now()
 WHERE checked_out_at IS NULL
   AND date < (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - INTERVAL '0 days'
   AND (
     -- Anything not opened on TODAY's business day (treating 05:00 EAT rollover)
     date < CASE
       WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5
         THEN ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - INTERVAL '1 day')::date
       ELSE (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
     END
   );

INSERT INTO public.cron_run_log(job_name, status, details)
VALUES (
  'auto_close_business_day',
  'ok',
  jsonb_build_object('manual_backfill', true, 'ran_at', now())
);