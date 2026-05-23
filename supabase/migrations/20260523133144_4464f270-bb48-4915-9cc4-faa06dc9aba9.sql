-- 1) Cancellation columns on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS idx_transactions_active
  ON public.transactions (casino_id, created_at)
  WHERE cancelled_at IS NULL;

-- 2) Audit table
CREATE TABLE IF NOT EXISTS public.transaction_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL,
  player_id uuid NOT NULL,
  shift_id uuid,
  business_date date,
  tx_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  cancelled_by uuid NOT NULL REFERENCES auth.users(id),
  cancelled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_cancel_casino_date
  ON public.transaction_cancellations (casino_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_cancel_cashier
  ON public.transaction_cancellations (cancelled_by, cancelled_at DESC);

ALTER TABLE public.transaction_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_cancel_select_authorized" ON public.transaction_cancellations;
CREATE POLICY "tx_cancel_select_authorized"
  ON public.transaction_cancellations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'floor_manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'surveillance'::app_role)
    OR public.has_role(auth.uid(), 'cashier'::app_role)
  );

DROP POLICY IF EXISTS "tx_cancel_insert_none" ON public.transaction_cancellations;
CREATE POLICY "tx_cancel_insert_none"
  ON public.transaction_cancellations
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 3) Trigger: log on cancellation flip
CREATE OR REPLACE FUNCTION public.trg_log_transaction_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business_date date;
BEGIN
  IF OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.table_id IS DISTINCT FROM OLD.table_id
       OR NEW.chips IS DISTINCT FROM OLD.chips
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
      RAISE EXCEPTION 'Cannot modify transaction fields during cancellation';
    END IF;
    IF NEW.cancel_reason IS NULL OR length(btrim(NEW.cancel_reason)) = 0 THEN
      RAISE EXCEPTION 'cancel_reason is required';
    END IF;
    IF NEW.cancelled_by IS NULL THEN
      RAISE EXCEPTION 'cancelled_by is required';
    END IF;

    v_business_date := (NEW.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;

    INSERT INTO public.transaction_cancellations (
      transaction_id, casino_id, player_id, shift_id, business_date,
      tx_type, amount, reason, cancelled_by, cancelled_at
    ) VALUES (
      NEW.id, NEW.casino_id, NEW.player_id, NEW.shift_id, v_business_date,
      NEW.type::text, NEW.amount, NEW.cancel_reason, NEW.cancelled_by, NEW.cancelled_at
    );
  ELSIF OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS NULL THEN
    RAISE EXCEPTION 'Cannot un-cancel a transaction';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_cancel ON public.transactions;
CREATE TRIGGER trg_transactions_cancel
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_transaction_cancellation();

-- 4) RPC for cashier
CREATE OR REPLACE FUNCTION public.cancel_transaction(p_transaction_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx public.transactions;
  v_shift_closed timestamptz;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required (min 3 chars)';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Transaction already cancelled'; END IF;

  IF NOT (public.has_role(v_uid, 'cashier'::app_role)
          OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only cashier or super admin can cancel transactions';
  END IF;

  IF v_tx.shift_id IS NOT NULL THEN
    SELECT closed_at INTO v_shift_closed FROM public.shifts WHERE id = v_tx.shift_id;
    IF v_shift_closed IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot cancel: shift is already closed';
    END IF;
  END IF;

  UPDATE public.transactions
    SET cancelled_at = now(),
        cancelled_by = v_uid,
        cancel_reason = btrim(p_reason)
    WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_transaction(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_transaction(uuid, text) TO authenticated;