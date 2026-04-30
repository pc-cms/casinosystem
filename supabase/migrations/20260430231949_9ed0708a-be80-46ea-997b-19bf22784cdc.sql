-- Auto-close prior open session when a new one is inserted for the same player.
-- Runs BEFORE the unique index is checked, so the INSERT always succeeds.

CREATE OR REPLACE FUNCTION public.client_session_autoclose_prior()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_sessions
     SET stopped_at = now()
   WHERE player_id  = NEW.player_id
     AND stopped_at IS NULL
     AND id <> NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_session_autoclose_prior ON public.client_sessions;
CREATE TRIGGER trg_client_session_autoclose_prior
  BEFORE INSERT ON public.client_sessions
  FOR EACH ROW
  WHEN (NEW.stopped_at IS NULL)
  EXECUTE FUNCTION public.client_session_autoclose_prior();