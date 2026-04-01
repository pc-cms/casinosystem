
-- 1. Add 'collection' to wallet_tx_type enum
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'collection';

-- 2. Enforce budget lock on structural changes to budget items
CREATE OR REPLACE FUNCTION public.enforce_budget_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.budget_periods 
    WHERE id = NEW.period_id AND is_locked = true
  ) THEN
    -- Allow updates to actual_amount and status even when locked (auto-sync)
    IF NEW.monthly_amount IS DISTINCT FROM OLD.monthly_amount
       OR NEW.reserved_amount IS DISTINCT FROM OLD.reserved_amount
       OR NEW.item_name IS DISTINCT FROM OLD.item_name
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.logic_type IS DISTINCT FROM OLD.logic_type THEN
      RAISE EXCEPTION 'Cannot modify budget structure in a locked period';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_budget_lock
BEFORE UPDATE ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_lock();

-- 3. Balance sufficiency check (skip for daily_result which can represent losses)
CREATE OR REPLACE FUNCTION public.check_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_bal numeric;
BEGIN
  IF NEW.from_wallet IS NOT NULL AND NEW.tx_type NOT IN ('daily_result') THEN
    SELECT current_balance INTO current_bal
    FROM public.financial_wallets
    WHERE casino_id = NEW.casino_id AND wallet_type = NEW.from_wallet;
    
    IF current_bal IS NOT NULL AND current_bal < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient balance in % wallet. Available: %, Required: %', 
        NEW.from_wallet, current_bal, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_wallet_balance
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.check_wallet_balance();
