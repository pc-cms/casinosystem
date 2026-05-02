-- ============================================================================
-- CHIP TRANSFERS — paired immutable records of chip movement between players
-- (no cash, no inventory effect; only NEP/Drop in client-side computation)
-- ============================================================================

CREATE TABLE public.chip_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  table_id uuid NULL,
  pair_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  player_id uuid NOT NULL,
  counterparty_player_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  chips jsonb NULL,
  note text NOT NULL DEFAULT '',
  operator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chip_transfers_casino_created ON public.chip_transfers(casino_id, created_at DESC);
CREATE INDEX idx_chip_transfers_player_created ON public.chip_transfers(player_id, created_at DESC);
CREATE INDEX idx_chip_transfers_pair ON public.chip_transfers(pair_id);
CREATE INDEX idx_chip_transfers_shift ON public.chip_transfers(shift_id);

ALTER TABLE public.chip_transfers ENABLE ROW LEVEL SECURITY;

-- RLS: pit/manager insert in own casino
CREATE POLICY "Pit/managers insert chip transfers"
  ON public.chip_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = public.get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Casino users see chip transfers"
  ON public.chip_transfers
  FOR SELECT
  TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()));

CREATE POLICY "Super/FM see all chip transfers"
  ON public.chip_transfers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Surveillance sees chip transfers"
  ON public.chip_transfers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'surveillance'::app_role) AND public.user_has_casino_access(auth.uid(), casino_id));

-- Immutable
CREATE OR REPLACE FUNCTION public.prevent_chip_transfer_modify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'chip_transfers records are immutable';
END;
$$;

CREATE TRIGGER trg_chip_transfers_no_update
  BEFORE UPDATE ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_chip_transfer_modify();

CREATE TRIGGER trg_chip_transfers_no_delete
  BEFORE DELETE ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_chip_transfer_modify();

-- Validate
CREATE OR REPLACE FUNCTION public.validate_chip_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.player_id = NEW.counterparty_player_id THEN
    RAISE EXCEPTION 'Chip transfer player and counterparty must differ';
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Chip transfer amount must be greater than zero';
  END IF;
  -- Both players must belong (or be visiting) the same casino — soft check via existence
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = NEW.player_id) THEN
    RAISE EXCEPTION 'Player not found: %', NEW.player_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = NEW.counterparty_player_id) THEN
    RAISE EXCEPTION 'Counterparty player not found: %', NEW.counterparty_player_id;
  END IF;
  -- Auto-attach shift if missing
  IF NEW.shift_id IS NULL THEN
    SELECT id INTO NEW.shift_id
      FROM public.shifts
     WHERE casino_id = NEW.casino_id AND status = 'open'
     LIMIT 1;
    IF NEW.shift_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create chip transfer without an active shift';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chip_transfers_validate
  BEFORE INSERT ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.validate_chip_transfer();

-- Ensure visit exists today for both players (so they appear in Player Statistics)
CREATE OR REPLACE FUNCTION public.ensure_visit_on_chip_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  v_today := (
    CASE
      WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5
        THEN ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1)
      ELSE (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    END
  );

  INSERT INTO public.casino_visits (casino_id, player_id, date, checked_in_by, checked_in_at, position)
  SELECT NEW.casino_id, NEW.player_id, v_today, NEW.operator_id, now(), 'hall'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.casino_visits
     WHERE casino_id = NEW.casino_id AND player_id = NEW.player_id AND date = v_today
  );

  -- Re-open if closed
  UPDATE public.casino_visits
     SET checked_out_at = NULL
   WHERE casino_id = NEW.casino_id
     AND player_id = NEW.player_id
     AND date = v_today
     AND checked_out_at IS NOT NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chip_transfers_ensure_visit
  AFTER INSERT ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.ensure_visit_on_chip_transfer();

-- Auto-log
CREATE OR REPLACE FUNCTION public.auto_log_chip_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id,
    'transaction'::public.log_category,
    CASE WHEN NEW.direction = 'in' THEN 'CHIP_TRANSFER_IN' ELSE 'CHIP_TRANSFER_OUT' END,
    NEW.operator_id,
    jsonb_build_object(
      'chip_transfer_id', NEW.id,
      'pair_id', NEW.pair_id,
      'player_id', NEW.player_id,
      'counterparty_player_id', NEW.counterparty_player_id,
      'amount', NEW.amount,
      'table_id', NEW.table_id,
      'shift_id', NEW.shift_id,
      'note', NEW.note,
      'source', 'db_trigger'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chip_transfers_auto_log
  AFTER INSERT ON public.chip_transfers
  FOR EACH ROW EXECUTE FUNCTION public.auto_log_chip_transfer();

-- Attach to sync engine
SELECT public.sync_attach('public.chip_transfers'::regclass);

-- Atomic pair-creation RPC
CREATE OR REPLACE FUNCTION public.create_chip_transfer_pair(
  _from_player uuid,
  _to_player uuid,
  _amount bigint,
  _table_id uuid DEFAULT NULL,
  _chips jsonb DEFAULT NULL,
  _note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id uuid;
  v_pair_id uuid := gen_random_uuid();
  v_op uuid := auth.uid();
  v_out_id uuid;
  v_in_id uuid;
BEGIN
  IF v_op IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (public.has_role(v_op, 'pit'::app_role) OR public.has_role(v_op, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Pit or Manager role required';
  END IF;
  IF _from_player = _to_player THEN
    RAISE EXCEPTION 'From and To players must differ';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  v_casino_id := public.get_user_casino_id(v_op);
  IF v_casino_id IS NULL THEN
    RAISE EXCEPTION 'Operator has no casino assigned';
  END IF;

  -- OUT (from_player gives chips away)
  INSERT INTO public.chip_transfers
    (casino_id, table_id, pair_id, direction, player_id, counterparty_player_id, amount, chips, note, operator_id)
  VALUES
    (v_casino_id, _table_id, v_pair_id, 'out', _from_player, _to_player, _amount, _chips, _note, v_op)
  RETURNING id INTO v_out_id;

  -- IN (to_player receives chips)
  INSERT INTO public.chip_transfers
    (casino_id, table_id, pair_id, direction, player_id, counterparty_player_id, amount, chips, note, operator_id)
  VALUES
    (v_casino_id, _table_id, v_pair_id, 'in', _to_player, _from_player, _amount, _chips, _note, v_op)
  RETURNING id INTO v_in_id;

  RETURN jsonb_build_object(
    'pair_id', v_pair_id,
    'out_id', v_out_id,
    'in_id', v_in_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_chip_transfer_pair(uuid, uuid, bigint, uuid, jsonb, text) TO authenticated;