-- Cashless (Mobile Money) transactions table
CREATE TABLE public.cashless_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  business_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('IN','OUT')),
  provider text NOT NULL CHECK (provider IN ('AIRTEL','MPESA','TIGO','HALOTEL')),
  player_id uuid,
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('pending','recorded','approved')),
  operator_id uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cashless_casino_date ON public.cashless_transactions (casino_id, business_date DESC);
CREATE INDEX idx_cashless_status ON public.cashless_transactions (casino_id, status) WHERE status = 'pending';
CREATE INDEX idx_cashless_player ON public.cashless_transactions (player_id) WHERE player_id IS NOT NULL;

ALTER TABLE public.cashless_transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: same-casino cashier/manager/finance_manager
CREATE POLICY "Casino cash/manager see cashless"
  ON public.cashless_transactions FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
    )
  );

CREATE POLICY "Super admin/FM see all cashless"
  ON public.cashless_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Surveillance sees cashless"
  ON public.cashless_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

-- INSERT: cashier or manager of own casino
CREATE POLICY "Cashier/manager insert cashless"
  ON public.cashless_transactions FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- UPDATE: only manager/finance_manager can approve pending → approved
CREATE POLICY "Manager approves cashless"
  ON public.cashless_transactions FOR UPDATE TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
  );

-- Trigger: enforce immutability of core fields and pending workflow
CREATE OR REPLACE FUNCTION public.cashless_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow flipping status pending → approved (with approver/timestamp).
  IF NEW.casino_id <> OLD.casino_id
     OR NEW.business_date <> OLD.business_date
     OR NEW.direction <> OLD.direction
     OR NEW.provider <> OLD.provider
     OR COALESCE(NEW.player_id::text,'') <> COALESCE(OLD.player_id::text,'')
     OR NEW.amount <> OLD.amount
     OR NEW.currency <> OLD.currency
     OR NEW.operator_id <> OLD.operator_id
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'Cashless transactions are immutable';
  END IF;

  IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    RAISE EXCEPTION 'Approved cashless transactions cannot be reverted';
  END IF;

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cashless_protect
  BEFORE UPDATE ON public.cashless_transactions
  FOR EACH ROW EXECUTE FUNCTION public.cashless_protect_immutable();

-- Trigger: enforce initial status by direction
CREATE OR REPLACE FUNCTION public.cashless_default_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.direction = 'OUT' THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'recorded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cashless_default_status
  BEFORE INSERT ON public.cashless_transactions
  FOR EACH ROW EXECUTE FUNCTION public.cashless_default_status();
