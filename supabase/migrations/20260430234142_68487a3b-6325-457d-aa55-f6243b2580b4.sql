-- ============================================================
-- bank_checks: auto-compute expected/discrepancy
-- ============================================================

-- Add columns for authoritative server-computed values
ALTER TABLE public.bank_checks
  ADD COLUMN IF NOT EXISTS expected_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discrepancy      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_balanced      boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.bank_check_compute()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_wallet_balance numeric := 0;
BEGIN
  -- expected = current bank wallet balance for this casino at the moment of insert
  -- (single source of truth — same wallet ledger used everywhere else)
  SELECT COALESCE(current_balance, 0)
    INTO v_wallet_balance
    FROM public.financial_wallets
   WHERE casino_id = NEW.casino_id
     AND wallet_type = 'bank_account'
   LIMIT 1;

  NEW.expected_balance := v_wallet_balance;
  NEW.discrepancy      := COALESCE(NEW.amount, 0) - v_wallet_balance;
  NEW.is_balanced      := (NEW.discrepancy = 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_check_compute ON public.bank_checks;
CREATE TRIGGER trg_bank_check_compute
  BEFORE INSERT OR UPDATE ON public.bank_checks
  FOR EACH ROW EXECUTE FUNCTION public.bank_check_compute();