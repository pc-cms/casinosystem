-- Auto-close active client_sessions when a casino_visit is checked out
CREATE OR REPLACE FUNCTION public.close_sessions_on_visit_checkout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_out_at IS NOT NULL AND (OLD.checked_out_at IS NULL) THEN
    UPDATE public.client_sessions
       SET stopped_at = NEW.checked_out_at
     WHERE casino_id = NEW.casino_id
       AND player_id = NEW.player_id
       AND stopped_at IS NULL
       AND started_at <= NEW.checked_out_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_sessions_on_visit_checkout ON public.casino_visits;
CREATE TRIGGER trg_close_sessions_on_visit_checkout
AFTER UPDATE OF checked_out_at ON public.casino_visits
FOR EACH ROW
EXECUTE FUNCTION public.close_sessions_on_visit_checkout();

-- One-off cleanup: close orphan sessions whose player's latest visit is already closed
WITH latest_visit AS (
  SELECT DISTINCT ON (casino_id, player_id)
         casino_id, player_id, checked_out_at, checked_in_at
    FROM public.casino_visits
   ORDER BY casino_id, player_id, checked_in_at DESC
)
UPDATE public.client_sessions s
   SET stopped_at = COALESCE(lv.checked_out_at, now())
  FROM latest_visit lv
 WHERE s.stopped_at IS NULL
   AND s.casino_id = lv.casino_id
   AND s.player_id = lv.player_id
   AND lv.checked_out_at IS NOT NULL;