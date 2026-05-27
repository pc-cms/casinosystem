ALTER TABLE public.cashless_transactions
  ADD CONSTRAINT cashless_transactions_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';