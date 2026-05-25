-- cashless_transactions.cage_type (uses existing cage_slots_shift_id column)
ALTER TABLE public.cashless_transactions
  ADD COLUMN IF NOT EXISTS cage_type text NOT NULL DEFAULT 'live_game';

ALTER TABLE public.cashless_transactions
  DROP CONSTRAINT IF EXISTS cashless_transactions_cage_type_check;
ALTER TABLE public.cashless_transactions
  ADD CONSTRAINT cashless_transactions_cage_type_check
  CHECK (cage_type IN ('live_game', 'slots'));

UPDATE public.cashless_transactions
SET cage_type = 'slots'
WHERE cage_slots_shift_id IS NOT NULL
  AND cage_type <> 'slots';

CREATE INDEX IF NOT EXISTS idx_cashless_cage_type_date
  ON public.cashless_transactions (cage_type, business_date);

-- expenses.cage_type (uses existing shift_id; slots will be tagged at insert)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cage_type text NOT NULL DEFAULT 'live_game';

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_cage_type_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_cage_type_check
  CHECK (cage_type IN ('live_game', 'slots'));

UPDATE public.expenses e
SET cage_type = 'slots'
WHERE e.shift_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.cage_slots_shifts s WHERE s.id = e.shift_id)
  AND e.cage_type <> 'slots';

CREATE INDEX IF NOT EXISTS idx_expenses_cage_type_date
  ON public.expenses (cage_type, business_date);

-- Auto-tag trigger for cashless (uses cage_slots_shift_id)
CREATE OR REPLACE FUNCTION public.set_cashless_cage_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cage_slots_shift_id IS NOT NULL THEN
    NEW.cage_type := 'slots';
  ELSE
    NEW.cage_type := COALESCE(NEW.cage_type, 'live_game');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashless_set_cage_type ON public.cashless_transactions;
CREATE TRIGGER trg_cashless_set_cage_type
  BEFORE INSERT ON public.cashless_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cashless_cage_type();

-- Auto-tag trigger for expenses (uses shift_id pointing to either shifts or cage_slots_shifts)
CREATE OR REPLACE FUNCTION public.set_expense_cage_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.cage_slots_shifts s WHERE s.id = NEW.shift_id) THEN
    NEW.cage_type := 'slots';
  ELSE
    NEW.cage_type := COALESCE(NEW.cage_type, 'live_game');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_set_cage_type ON public.expenses;
CREATE TRIGGER trg_expenses_set_cage_type
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_cage_type();