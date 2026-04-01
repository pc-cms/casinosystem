
-- Wallet types enum
CREATE TYPE public.wallet_type AS ENUM (
  'main_cash', 'office_safe', 
  'rent_reserve', 'license_reserve', 'tax_reserve', 'other_reserve'
);

-- Office expense categories enum
CREATE TYPE public.office_expense_category AS ENUM (
  'salary', 'bonus', 'fuel', 'transport', 'repairs', 'internet_it', 'security_expense', 'cleaning',
  'rent', 'utilities', 'office',
  'gaming_tax', 'fixed_tax', 'license', 'visa',
  'machines', 'parts',
  'debts', 'adjustments', 'other_office'
);

-- Wallet transaction types enum
CREATE TYPE public.wallet_tx_type AS ENUM (
  'transfer', 'allocate_reserve', 'use_reserve', 'manual_expense', 'daily_result', 'initial_balance'
);

-- Financial wallets table
CREATE TABLE public.financial_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  wallet_type wallet_type NOT NULL,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(casino_id, wallet_type)
);

ALTER TABLE public.financial_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see wallets" ON public.financial_wallets
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

CREATE POLICY "Casino fm/managers insert wallets" ON public.financial_wallets
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

CREATE POLICY "Casino fm/managers update wallets" ON public.financial_wallets
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

-- Wallet transactions (immutable ledger)
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  tx_type wallet_tx_type NOT NULL,
  from_wallet wallet_type,
  to_wallet wallet_type,
  amount NUMERIC NOT NULL,
  expense_category office_expense_category,
  description TEXT NOT NULL DEFAULT '',
  operator_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see wallet txs" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

CREATE POLICY "Casino fm/managers insert wallet txs" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND operator_id = auth.uid() AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

-- Prevent modification/deletion of wallet transactions (audit-safe)
CREATE OR REPLACE FUNCTION public.prevent_wallet_tx_modify()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Wallet transactions are immutable and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER trg_prevent_wallet_tx_update BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION prevent_wallet_tx_modify();
CREATE TRIGGER trg_prevent_wallet_tx_delete BEFORE DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION prevent_wallet_tx_modify();

-- Daily summaries table
CREATE TABLE public.daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  date DATE NOT NULL,
  tables_result NUMERIC NOT NULL DEFAULT 0,
  slots_result NUMERIC NOT NULL DEFAULT 0,
  total_result NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(casino_id, date)
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see daily summaries" ON public.daily_summaries
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

CREATE POLICY "Casino fm/managers insert daily summaries" ON public.daily_summaries
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

CREATE POLICY "Casino fm/managers update daily summaries" ON public.daily_summaries
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance_manager')));

-- Trigger to update wallet balance on transaction insert
CREATE OR REPLACE FUNCTION public.update_wallet_balances()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Deduct from source wallet
  IF NEW.from_wallet IS NOT NULL THEN
    UPDATE public.financial_wallets
    SET current_balance = current_balance - NEW.amount, updated_at = now()
    WHERE casino_id = NEW.casino_id AND wallet_type = NEW.from_wallet;
  END IF;
  -- Add to destination wallet
  IF NEW.to_wallet IS NOT NULL THEN
    UPDATE public.financial_wallets
    SET current_balance = current_balance + NEW.amount, updated_at = now()
    WHERE casino_id = NEW.casino_id AND wallet_type = NEW.to_wallet;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_wallet_balances AFTER INSERT ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION update_wallet_balances();

-- Validate wallet transaction amount > 0
CREATE OR REPLACE FUNCTION public.validate_wallet_tx()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Wallet transaction amount must be greater than zero';
  END IF;
  IF NEW.from_wallet IS NULL AND NEW.to_wallet IS NULL THEN
    RAISE EXCEPTION 'Transaction must have at least one wallet (from or to)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_wallet_tx BEFORE INSERT ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION validate_wallet_tx();
