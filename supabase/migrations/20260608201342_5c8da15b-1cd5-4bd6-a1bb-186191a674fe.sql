ALTER TABLE public.player_daily_avg_bet_changes DROP CONSTRAINT IF EXISTS player_daily_avg_bet_changes_game_group_check;
UPDATE public.player_daily_avg_bet_changes SET game_group = 'bj' WHERE game_group = 'bg';
ALTER TABLE public.player_daily_avg_bet_changes ADD CONSTRAINT player_daily_avg_bet_changes_game_group_check CHECK (game_group = ANY (ARRAY['ar'::text, 'bj'::text, 'poker'::text]));