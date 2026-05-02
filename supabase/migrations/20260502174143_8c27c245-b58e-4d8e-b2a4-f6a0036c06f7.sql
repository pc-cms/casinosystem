ALTER TABLE public.cashless_transactions ADD COLUMN IF NOT EXISTS player_name text NOT NULL DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS player_name text NOT NULL DEFAULT '';