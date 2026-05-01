CREATE OR REPLACE FUNCTION public.ensure_visit_on_session_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_existing uuid;
BEGIN
  -- Business date in Africa/Dar_es_Salaam (UTC+3), with 05:00 rollover
  v_today := (
    CASE
      WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5
        THEN ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1)
      ELSE (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    END
  );

  SELECT id INTO v_existing
    FROM public.casino_visits
   WHERE casino_id = NEW.casino_id
     AND player_id = NEW.player_id
     AND date = v_today
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.casino_visits (casino_id, player_id, date, checked_in_by, checked_in_at, position)
    VALUES (NEW.casino_id, NEW.player_id, v_today, NEW.created_by, now(), 'table');
  ELSE
    -- Re-open if it was closed; refresh position to 'table'
    UPDATE public.casino_visits
       SET checked_out_at = NULL,
           position = 'table'
     WHERE id = v_existing;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_visit_on_session_start ON public.client_sessions;
CREATE TRIGGER trg_ensure_visit_on_session_start
AFTER INSERT ON public.client_sessions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_visit_on_session_start();

-- One-off: re-open today's visits for any player who currently has an active session
WITH biz AS (
  SELECT
    CASE
      WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5
        THEN ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1)
      ELSE (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    END AS today
)
UPDATE public.casino_visits cv
   SET checked_out_at = NULL,
       position = 'table'
  FROM biz, public.client_sessions s
 WHERE s.stopped_at IS NULL
   AND s.casino_id = cv.casino_id
   AND s.player_id = cv.player_id
   AND cv.date = biz.today
   AND cv.checked_out_at IS NOT NULL;