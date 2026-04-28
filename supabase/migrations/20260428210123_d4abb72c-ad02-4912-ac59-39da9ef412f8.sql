-- Cage transfers: internal cashier operations (add_float, collection, fill, credit)
CREATE TABLE public.cage_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  transfer_type text NOT NULL,
  direction text NOT NULL,
  table_id uuid NULL,
  amount bigint NOT NULL,
  chips jsonb NULL,
  note text NOT NULL DEFAULT '',
  operator_id uuid NOT NULL,
  approved_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cage_transfers_shift ON public.cage_transfers(shift_id);
CREATE INDEX idx_cage_transfers_casino_date ON public.cage_transfers(casino_id, created_at DESC);

ALTER TABLE public.cage_transfers ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Casino users see cage transfers"
  ON public.cage_transfers FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Surveillance sees cage transfers"
  ON public.cage_transfers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Super/FM see all cage transfers"
  ON public.cage_transfers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Cashiers/managers insert cage transfers"
  ON public.cage_transfers FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- Validation
CREATE OR REPLACE FUNCTION public.validate_cage_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.transfer_type NOT IN ('add_float','collection','fill','credit') THEN
    RAISE EXCEPTION 'Invalid transfer_type: %', NEW.transfer_type;
  END IF;
  IF NEW.direction NOT IN ('cash_in','cash_out','chip_to_table','chip_from_table') THEN
    RAISE EXCEPTION 'Invalid direction: %', NEW.direction;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Cage transfer amount must be greater than zero';
  END IF;
  IF NEW.transfer_type IN ('fill','credit') THEN
    IF NEW.table_id IS NULL THEN
      RAISE EXCEPTION '% requires table_id', NEW.transfer_type;
    END IF;
    IF NEW.chips IS NULL OR jsonb_typeof(NEW.chips) <> 'object' THEN
      RAISE EXCEPTION '% requires chips breakdown', NEW.transfer_type;
    END IF;
  ELSE
    IF NEW.table_id IS NOT NULL THEN
      RAISE EXCEPTION '% must not have table_id', NEW.transfer_type;
    END IF;
  END IF;
  -- Must have an open shift
  IF NOT EXISTS (SELECT 1 FROM public.shifts WHERE id = NEW.shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Cage transfer requires an open shift';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cage_transfer
  BEFORE INSERT ON public.cage_transfers
  FOR EACH ROW EXECUTE FUNCTION public.validate_cage_transfer();

-- Immutability
CREATE OR REPLACE FUNCTION public.prevent_cage_transfer_modify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Cage transfers are immutable';
END;
$$;

CREATE TRIGGER trg_prevent_cage_transfer_update
  BEFORE UPDATE ON public.cage_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cage_transfer_modify();

CREATE TRIGGER trg_prevent_cage_transfer_delete
  BEFORE DELETE ON public.cage_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cage_transfer_modify();

-- Apply chip movement for fill/credit
CREATE OR REPLACE FUNCTION public.apply_cage_transfer_chip_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_denom bigint;
  v_qty bigint;
  v_cashier_delta bigint;
  v_table_delta bigint;
BEGIN
  IF NEW.transfer_type NOT IN ('fill','credit') THEN
    RETURN NEW;
  END IF;
  IF NEW.chips IS NULL OR jsonb_typeof(NEW.chips) <> 'object' THEN
    RETURN NEW;
  END IF;

  FOR v_denom, v_qty IN
    SELECT (key)::bigint, (value)::bigint
    FROM jsonb_each_text(NEW.chips)
    WHERE value ~ '^[0-9]+$' AND (value)::bigint > 0
  LOOP
    IF NEW.transfer_type = 'fill' THEN
      v_cashier_delta := -v_qty;
      v_table_delta := v_qty;
    ELSE -- credit
      v_cashier_delta := v_qty;
      v_table_delta := -v_qty;
    END IF;

    -- Cashier inventory
    INSERT INTO public.chip_inventory (casino_id, location_type, location_id, denomination, quantity, updated_by)
    VALUES (NEW.casino_id, 'cashier', NULL, v_denom, GREATEST(v_cashier_delta, 0), NEW.operator_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.chip_inventory
       SET quantity = quantity + v_cashier_delta,
           updated_at = now(),
           updated_by = NEW.operator_id
     WHERE casino_id = NEW.casino_id
       AND location_type = 'cashier'
       AND location_id IS NULL
       AND denomination = v_denom;

    -- Table inventory
    INSERT INTO public.chip_inventory (casino_id, location_type, location_id, denomination, quantity, updated_by)
    VALUES (NEW.casino_id, 'table', NEW.table_id, v_denom, GREATEST(v_table_delta, 0), NEW.operator_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.chip_inventory
       SET quantity = quantity + v_table_delta,
           updated_at = now(),
           updated_by = NEW.operator_id
     WHERE casino_id = NEW.casino_id
       AND location_type = 'table'
       AND location_id = NEW.table_id
       AND denomination = v_denom;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_cage_transfer_chip_movement
  AFTER INSERT ON public.cage_transfers
  FOR EACH ROW EXECUTE FUNCTION public.apply_cage_transfer_chip_movement();

-- Audit log
CREATE OR REPLACE FUNCTION public.auto_log_cage_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id,
    'transaction',
    UPPER(NEW.transfer_type),
    NEW.operator_id,
    jsonb_build_object(
      'cage_transfer_id', NEW.id,
      'transfer_type', NEW.transfer_type,
      'direction', NEW.direction,
      'amount', NEW.amount,
      'table_id', NEW.table_id,
      'shift_id', NEW.shift_id,
      'approved_by', NEW.approved_by,
      'source', 'db_trigger'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_log_cage_transfer
  AFTER INSERT ON public.cage_transfers
  FOR EACH ROW EXECUTE FUNCTION public.auto_log_cage_transfer();