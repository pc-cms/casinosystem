
-- 1. Add business_date column to wallet_transactions for daily_result dedup
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS business_date date;

-- 2. Enforce expense_category NOT NULL for expense-type transactions
CREATE OR REPLACE FUNCTION public.validate_expense_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tx_type IN ('manual_expense', 'use_reserve') AND NEW.expense_category IS NULL THEN
    RAISE EXCEPTION 'expense_category is required for % transactions', NEW.tx_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_expense_category
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_category();

-- 3. Enforce collection only from main_cash or office_safe
CREATE OR REPLACE FUNCTION public.validate_collection_wallet()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tx_type = 'collection' AND NEW.from_wallet NOT IN ('main_cash', 'office_safe') THEN
    RAISE EXCEPTION 'Collection is only allowed from main_cash or office_safe, not %', NEW.from_wallet;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_collection_wallet
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_collection_wallet();

-- 4. Unique constraint on daily_result per business_date per casino
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_daily_result_unique
ON public.wallet_transactions (casino_id, business_date)
WHERE tx_type = 'daily_result' AND business_date IS NOT NULL;
