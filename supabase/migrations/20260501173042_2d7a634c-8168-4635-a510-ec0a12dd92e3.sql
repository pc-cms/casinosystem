-- 1) Auto check-in on any transaction (buy / cashout / etc.)
CREATE OR REPLACE FUNCTION public.ensure_visit_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_existing uuid;
BEGIN
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
    VALUES (NEW.casino_id, NEW.player_id, v_today, NEW.operator_id, now(), 'hall');
  ELSE
    UPDATE public.casino_visits
       SET checked_out_at = NULL
     WHERE id = v_existing
       AND checked_out_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_visit_on_transaction ON public.transactions;
CREATE TRIGGER trg_ensure_visit_on_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_visit_on_transaction();

-- 2) Extend the existing visit checkout trigger: also reset position to 'hall'
CREATE OR REPLACE FUNCTION public.close_sessions_on_visit_checkout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_out_at IS NOT NULL AND OLD.checked_out_at IS NULL THEN
    UPDATE public.client_sessions
       SET stopped_at = NEW.checked_out_at
     WHERE casino_id = NEW.casino_id
       AND player_id = NEW.player_id
       AND stopped_at IS NULL
       AND started_at <= NEW.checked_out_at;

    -- Reset position so they leave Active Players / table view even if just seated without a session
    NEW.position := 'hall';
  END IF;
  RETURN NEW;
END;
$$;

-- Switch to BEFORE so we can mutate NEW.position
DROP TRIGGER IF EXISTS trg_close_sessions_on_visit_checkout ON public.casino_visits;
CREATE TRIGGER trg_close_sessions_on_visit_checkout
BEFORE UPDATE OF checked_out_at ON public.casino_visits
FOR EACH ROW
EXECUTE FUNCTION public.close_sessions_on_visit_checkout();