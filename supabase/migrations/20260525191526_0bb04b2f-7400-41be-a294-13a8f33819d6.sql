
-- =============================================================
-- Cage Slots Transfers + cross-cage approval workflow
-- =============================================================

-- 1) New table for slots-side transfers
CREATE TABLE IF NOT EXISTS public.cage_slots_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id),
  transfer_type text NOT NULL CHECK (transfer_type IN ('fill','collection','lg_in','lg_out')),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount bigint NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  operator_id uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  -- Cross-cage approval
  counterpart_lg_shift_id uuid NULL REFERENCES public.shifts(id),
  counterpart_lg_transfer_id uuid NULL REFERENCES public.cage_transfers(id),
  requires_approval boolean NOT NULL DEFAULT false,
  approved_at timestamptz NULL,
  approved_by_user uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cage_slots_transfers_shift
  ON public.cage_slots_transfers (cage_slots_shift_id);
CREATE INDEX IF NOT EXISTS idx_cage_slots_transfers_casino_date
  ON public.cage_slots_transfers (casino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cage_slots_transfers_pending
  ON public.cage_slots_transfers (counterpart_lg_shift_id)
  WHERE requires_approval = true AND approved_at IS NULL;

-- 2) Approval columns on existing cage_transfers (Live Game side mirror)
ALTER TABLE public.cage_transfers
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approved_by_user uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS counterpart_slots_transfer_id uuid NULL REFERENCES public.cage_slots_transfers(id);

CREATE INDEX IF NOT EXISTS idx_cage_transfers_pending
  ON public.cage_transfers (shift_id)
  WHERE requires_approval = true AND approved_at IS NULL;

-- 3) Relax prevent-update trigger on cage_transfers so only approval fields are mutable
CREATE OR REPLACE FUNCTION public.prevent_cage_transfer_modify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cage_transfers rows are immutable';
  END IF;
  -- Allow updates only to approval bookkeeping fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.transfer_type IS DISTINCT FROM OLD.transfer_type
       OR NEW.direction IS DISTINCT FROM OLD.direction
       OR NEW.table_id IS DISTINCT FROM OLD.table_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.chips::text IS DISTINCT FROM OLD.chips::text
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'cage_transfers rows are immutable (only approval fields can change)';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Immutability trigger for cage_slots_transfers (same idea)
CREATE OR REPLACE FUNCTION public.prevent_cage_slots_transfer_modify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cage_slots_transfers rows are immutable';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.cage_slots_shift_id IS DISTINCT FROM OLD.cage_slots_shift_id
       OR NEW.transfer_type IS DISTINCT FROM OLD.transfer_type
       OR NEW.direction IS DISTINCT FROM OLD.direction
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'cage_slots_transfers rows are immutable (only approval fields can change)';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cage_slots_transfer_modify ON public.cage_slots_transfers;
CREATE TRIGGER trg_prevent_cage_slots_transfer_modify
  BEFORE UPDATE OR DELETE ON public.cage_slots_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cage_slots_transfer_modify();

-- 5) RLS
ALTER TABLE public.cage_slots_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Casino users see slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Casino users see slots transfers"
  ON public.cage_slots_transfers FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

DROP POLICY IF EXISTS "Super/FM see all slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Super/FM see all slots transfers"
  ON public.cage_slots_transfers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role));

DROP POLICY IF EXISTS "Cashiers/managers insert slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Cashiers/managers insert slots transfers"
  ON public.cage_slots_transfers FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Cashiers/managers approve slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Cashiers/managers approve slots transfers"
  ON public.cage_slots_transfers FOR UPDATE TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
  );

-- Add UPDATE policy for cage_transfers (approval)
DROP POLICY IF EXISTS "Cashiers/managers approve cage transfers" ON public.cage_transfers;
CREATE POLICY "Cashiers/managers approve cage transfers"
  ON public.cage_transfers FOR UPDATE TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
  );
