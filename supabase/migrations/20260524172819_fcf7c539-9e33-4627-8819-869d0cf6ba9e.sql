
-- 1. Main table: current avg bet per player per business day, split by game group
CREATE TABLE IF NOT EXISTS public.player_daily_avg_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  avg_bet_ar NUMERIC,
  avg_bet_bg NUMERIC,
  avg_bet_poker NUMERIC,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, player_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_player_daily_avg_bets_casino_date
  ON public.player_daily_avg_bets(casino_id, business_date);
CREATE INDEX IF NOT EXISTS idx_player_daily_avg_bets_player
  ON public.player_daily_avg_bets(player_id, business_date);

-- 2. Change log: every edit captured for end-of-day averaging
CREATE TABLE IF NOT EXISTS public.player_daily_avg_bet_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  game_group TEXT NOT NULL CHECK (game_group IN ('ar','bg','poker')),
  value NUMERIC NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_daily_avg_bet_changes_lookup
  ON public.player_daily_avg_bet_changes(casino_id, business_date, player_id, game_group);

-- 3. RLS
ALTER TABLE public.player_daily_avg_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_daily_avg_bet_changes ENABLE ROW LEVEL SECURITY;

-- Helper inline: read for any authenticated user in the casino
CREATE POLICY "pdab_read"
  ON public.player_daily_avg_bets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pdab_write_pit_mgr"
  ON public.player_daily_avg_bets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'pit') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'floor_manager') OR
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "pdab_update_pit_mgr"
  ON public.player_daily_avg_bets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'pit') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'floor_manager') OR
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "pdab_changes_read"
  ON public.player_daily_avg_bet_changes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pdab_changes_insert"
  ON public.player_daily_avg_bet_changes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'pit') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'floor_manager') OR
    public.has_role(auth.uid(), 'super_admin')
  );

-- 4. Trigger: every insert/update writes a change-log entry per modified group
CREATE OR REPLACE FUNCTION public.log_player_daily_avg_bet_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.avg_bet_ar IS DISTINCT FROM OLD.avg_bet_ar THEN
    IF NEW.avg_bet_ar IS NOT NULL THEN
      INSERT INTO public.player_daily_avg_bet_changes
        (casino_id, player_id, business_date, game_group, value, changed_by)
      VALUES (NEW.casino_id, NEW.player_id, NEW.business_date, 'ar', NEW.avg_bet_ar, NEW.updated_by);
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.avg_bet_bg IS DISTINCT FROM OLD.avg_bet_bg THEN
    IF NEW.avg_bet_bg IS NOT NULL THEN
      INSERT INTO public.player_daily_avg_bet_changes
        (casino_id, player_id, business_date, game_group, value, changed_by)
      VALUES (NEW.casino_id, NEW.player_id, NEW.business_date, 'bg', NEW.avg_bet_bg, NEW.updated_by);
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
$$;

DROP TRIGGER IF EXISTS trg_pdab_log ON public.player_daily_avg_bets;
CREATE TRIGGER trg_pdab_log
  BEFORE INSERT OR UPDATE ON public.player_daily_avg_bets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_player_daily_avg_bet_change();

-- 5. Finalize RPC: average all changes for a given business day and write back
CREATE OR REPLACE FUNCTION public.finalize_player_daily_avg_bets(
  p_casino_id UUID,
  p_business_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH avgs AS (
    SELECT
      player_id,
      AVG(value) FILTER (WHERE game_group = 'ar')    AS ar,
      AVG(value) FILTER (WHERE game_group = 'bg')    AS bg,
      AVG(value) FILTER (WHERE game_group = 'poker') AS poker
    FROM public.player_daily_avg_bet_changes
    WHERE casino_id = p_casino_id
      AND business_date = p_business_date
    GROUP BY player_id
  )
  INSERT INTO public.player_daily_avg_bets
    (casino_id, player_id, business_date, avg_bet_ar, avg_bet_bg, avg_bet_poker)
  SELECT p_casino_id, player_id, p_business_date,
         ROUND(ar)::numeric, ROUND(bg)::numeric, ROUND(poker)::numeric
  FROM avgs
  ON CONFLICT (casino_id, player_id, business_date)
  DO UPDATE SET
    avg_bet_ar    = COALESCE(EXCLUDED.avg_bet_ar,    public.player_daily_avg_bets.avg_bet_ar),
    avg_bet_bg    = COALESCE(EXCLUDED.avg_bet_bg,    public.player_daily_avg_bets.avg_bet_bg),
    avg_bet_poker = COALESCE(EXCLUDED.avg_bet_poker, public.player_daily_avg_bets.avg_bet_poker),
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_player_daily_avg_bets(UUID, DATE) TO authenticated;
