-- Fix avg_bet column rename: bg → bj in trigger function and finalize function
CREATE OR REPLACE FUNCTION public.log_player_daily_avg_bet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.avg_bet_ar IS DISTINCT FROM OLD.avg_bet_ar THEN
    IF NEW.avg_bet_ar IS NOT NULL THEN
      INSERT INTO public.player_daily_avg_bet_changes
        (casino_id, player_id, business_date, game_group, value, changed_by)
      VALUES (NEW.casino_id, NEW.player_id, NEW.business_date, 'ar', NEW.avg_bet_ar, NEW.updated_by);
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.avg_bet_bj IS DISTINCT FROM OLD.avg_bet_bj THEN
    IF NEW.avg_bet_bj IS NOT NULL THEN
      INSERT INTO public.player_daily_avg_bet_changes
        (casino_id, player_id, business_date, game_group, value, changed_by)
      VALUES (NEW.casino_id, NEW.player_id, NEW.business_date, 'bj', NEW.avg_bet_bj, NEW.updated_by);
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.avg_bet_poker IS DISTINCT FROM OLD.avg_bet_poker THEN
    IF NEW.avg_bet_poker IS NOT NULL THEN
      INSERT INTO public.player_daily_avg_bet_changes
        (casino_id, player_id, business_date, game_group, value, changed_by)
      VALUES (NEW.casino_id, NEW.player_id, NEW.business_date, 'poker', NEW.avg_bet_poker, NEW.updated_by);
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_player_daily_avg_bets(p_casino_id uuid, p_business_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH avgs AS (
    SELECT
      player_id,
      AVG(value) FILTER (WHERE game_group = 'ar')    AS ar,
      AVG(value) FILTER (WHERE game_group = 'bj')    AS bj,
      AVG(value) FILTER (WHERE game_group = 'poker') AS poker
    FROM public.player_daily_avg_bet_changes
    WHERE casino_id = p_casino_id
      AND business_date = p_business_date
    GROUP BY player_id
  )
  INSERT INTO public.player_daily_avg_bets
    (casino_id, player_id, business_date, avg_bet_ar, avg_bet_bj, avg_bet_poker)
  SELECT p_casino_id, player_id, p_business_date,
         ROUND(ar)::numeric, ROUND(bj)::numeric, ROUND(poker)::numeric
  FROM avgs
  ON CONFLICT (casino_id, player_id, business_date)
  DO UPDATE SET
    avg_bet_ar    = COALESCE(EXCLUDED.avg_bet_ar,    public.player_daily_avg_bets.avg_bet_ar),
    avg_bet_bj    = COALESCE(EXCLUDED.avg_bet_bj,    public.player_daily_avg_bets.avg_bet_bj),
    avg_bet_poker = COALESCE(EXCLUDED.avg_bet_poker, public.player_daily_avg_bets.avg_bet_poker),
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;