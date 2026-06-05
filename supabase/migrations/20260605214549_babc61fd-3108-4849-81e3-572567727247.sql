
DO $$
DECLARE pid uuid := '5255d902-f915-4a85-a7fe-1fd7f1813ab4';
BEGIN
  ALTER TABLE public.transactions DISABLE TRIGGER USER;
  ALTER TABLE public.casino_visits DISABLE TRIGGER USER;
  ALTER TABLE public.client_sessions DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;

  DELETE FROM public.transactions WHERE player_id = pid;
  DELETE FROM public.casino_visits WHERE player_id = pid;
  DELETE FROM public.client_sessions WHERE player_id = pid;
  DELETE FROM public.expenses WHERE player_id = pid;
  DELETE FROM public.player_cards WHERE player_id = pid;
  DELETE FROM public.player_tags WHERE player_id = pid;
  DELETE FROM public.player_notes WHERE player_id = pid;
  DELETE FROM public.player_chip_adjustments WHERE player_id = pid;
  DELETE FROM public.player_position_history WHERE player_id = pid;
  DELETE FROM public.player_daily_avg_bets WHERE player_id = pid;
  DELETE FROM public.player_daily_avg_bet_changes WHERE player_id = pid;
  DELETE FROM public.group_members WHERE player_id = pid;
  DELETE FROM public.kyc_reviews WHERE player_id = pid;
  DELETE FROM public.club_accounts WHERE player_id = pid;
  DELETE FROM public.players WHERE id = pid;

  ALTER TABLE public.transactions ENABLE TRIGGER USER;
  ALTER TABLE public.casino_visits ENABLE TRIGGER USER;
  ALTER TABLE public.client_sessions ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
END $$;
