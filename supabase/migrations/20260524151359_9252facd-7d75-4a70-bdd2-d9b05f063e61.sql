
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tips_recipient_employee_id uuid NULL
  REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tips
  ON public.transactions (casino_id, business_date, type)
  WHERE type IN ('tips_live','tips_poker','tips_floor');

CREATE INDEX IF NOT EXISTS idx_transactions_tips_recipient
  ON public.transactions (casino_id, tips_recipient_employee_id, business_date)
  WHERE type = 'tips_floor';
