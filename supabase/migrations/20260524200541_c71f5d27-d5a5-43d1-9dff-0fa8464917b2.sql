ALTER TABLE public.casino_visits
DROP CONSTRAINT IF EXISTS casino_visits_casino_id_player_id_date_key;

DROP INDEX IF EXISTS public.casino_visits_casino_id_player_id_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_casino_visits_open_per_player
ON public.casino_visits (player_id)
WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_casino_visits_casino_date_player_checked_in
ON public.casino_visits (casino_id, date, player_id, checked_in_at DESC);