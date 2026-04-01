
-- Add new transaction types to wallet_tx_type enum
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'adjustment';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'external_income';

-- Update the validate_expense_category trigger to also require category for adjustments
CREATE OR REPLACE FUNCTION public.validate_expense_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tx_type IN ('manual_expense', 'use_reserve') AND NEW.expense_category IS NULL THEN
    RAISE EXCEPTION 'expense_category is required for % transactions', NEW.tx_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update collection validation: allow negative balance (remove overdraft block for collection)
-- The check_wallet_balance already exempts daily_result; now also exempt collection and adjustment
CREATE OR REPLACE FUNCTION public.check_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_bal numeric;
BEGIN
  IF NEW.from_wallet IS NOT NULL AND NEW.tx_type NOT IN ('daily_result', 'collection', 'adjustment') THEN
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
$function$;
