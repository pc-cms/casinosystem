
ALTER TABLE public.transaction_cancellations
  ADD CONSTRAINT transaction_cancellations_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_cancellations
  ADD CONSTRAINT transaction_cancellations_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_cancellations
  ADD CONSTRAINT transaction_cancellations_casino_id_fkey
    FOREIGN KEY (casino_id) REFERENCES public.casinos(id) ON DELETE SET NULL;

ALTER TABLE public.cctv_observations
  ADD CONSTRAINT cctv_observations_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.cctv_observations
  ADD CONSTRAINT cctv_observations_table_id_fkey
    FOREIGN KEY (table_id) REFERENCES public.gaming_tables(id) ON DELETE SET NULL;

ALTER TABLE public.cashless_transactions
  ADD CONSTRAINT cashless_transactions_casino_id_fkey
    FOREIGN KEY (casino_id) REFERENCES public.casinos(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
