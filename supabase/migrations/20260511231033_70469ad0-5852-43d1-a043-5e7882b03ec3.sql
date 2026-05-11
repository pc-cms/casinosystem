-- 1. New columns
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS cash_desk_result bigint,
  ADD COLUMN IF NOT EXISTS balance bigint;

-- 2. Compute RPC: returns JSONB with all 9 components + cash_desk_result + shift_balance
CREATE OR REPLACE FUNCTION public.compute_shift_balance(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s              public.shifts%ROWTYPE;
  v_op_total     bigint := 0;
  v_op_chips     bigint := 0;
  v_cl_total     bigint := 0;
  v_cl_chips     bigint := 0;
  v_opening_cash bigint := 0;
  v_closing_cash bigint := 0;
  v_delta_cash   bigint := 0;
  v_expenses     bigint := 0;
  v_add_float    bigint := 0;
  v_collection   bigint := 0;
  v_slots_in     bigint := 0;
  v_slots_out    bigint := 0;
  v_miss         bigint := 0;
  v_tables       bigint := 0;
  v_cash_desk    bigint := 0;
  v_balance      bigint := 0;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'shift_not_found');
  END IF;

  -- Opening cash = opening_float.totals.total_tzs − chips_tzs
  v_op_total := COALESCE((s.opening_float->'totals'->>'total_tzs')::bigint, 0);
  v_op_chips := COALESCE((s.opening_float->'totals'->>'chips_tzs')::bigint, 0);
  v_opening_cash := GREATEST(v_op_total - v_op_chips, 0);

  -- Closing cash = closing_count.totals.total_tzs − chips_tzs
  v_cl_total := COALESCE((s.closing_count->'totals'->>'total_tzs')::bigint, 0);
  v_cl_chips := COALESCE((s.closing_count->'totals'->>'chips_tzs')::bigint, 0);
  v_closing_cash := GREATEST(v_cl_total - v_cl_chips, 0);

  v_delta_cash := v_closing_cash - v_opening_cash;

  -- Expenses for this shift
  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses
    FROM public.expenses
   WHERE shift_id = _shift_id;

  -- Cage transfers — split by type
  SELECT
    COALESCE(SUM(CASE WHEN transfer_type = 'add_float'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'collection' THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'slots_in'   THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'slots_out'  THEN amount END), 0)::bigint
  INTO v_add_float, v_collection, v_slots_in, v_slots_out
  FROM public.cage_transfers
  WHERE shift_id = _shift_id;

  v_miss   := COALESCE(s.miss_total, 0)::bigint;
  v_tables := COALESCE(s.tables_result, 0)::bigint;

  -- Canonical formula:
  --   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn + Miss
  --   Shift Balance    = Cash Desk Result − Tables Result   (= 0 when all entered)
  v_cash_desk := v_delta_cash + v_expenses + v_collection - v_add_float + v_slots_out - v_slots_in + v_miss;
  v_balance   := v_cash_desk - v_tables;

  RETURN jsonb_build_object(
    'opening_cash',     v_opening_cash,
    'closing_cash',     v_closing_cash,
    'delta_cash',       v_delta_cash,
    'expenses',         v_expenses,
    'collection',       v_collection,
    'add_float',        v_add_float,
    'slots_in',         v_slots_in,
    'slots_out',        v_slots_out,
    'miss',             v_miss,
    'tables_result',    v_tables,
    'cash_desk_result', v_cash_desk,
    'shift_balance',    v_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_shift_balance(uuid) TO authenticated, anon;

-- 3. Trigger that keeps shifts.cash_desk_result and shifts.balance in sync
CREATE OR REPLACE FUNCTION public.trg_shifts_recompute_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  v := public.compute_shift_balance(NEW.id);
  NEW.cash_desk_result := COALESCE((v->>'cash_desk_result')::bigint, 0);
  NEW.balance          := COALESCE((v->>'shift_balance')::bigint, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shifts_recompute_balance ON public.shifts;
CREATE TRIGGER shifts_recompute_balance
  BEFORE INSERT OR UPDATE OF status, opening_float, closing_count, closing_cash, miss_total, tables_result
  ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shifts_recompute_balance();

-- 4. Trigger when cage_transfers / expenses change → recompute owning shift
CREATE OR REPLACE FUNCTION public.trg_recompute_shift_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift uuid;
  v jsonb;
BEGIN
  v_shift := COALESCE(NEW.shift_id, OLD.shift_id);
  IF v_shift IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v := public.compute_shift_balance(v_shift);
  UPDATE public.shifts
     SET cash_desk_result = COALESCE((v->>'cash_desk_result')::bigint, 0),
         balance          = COALESCE((v->>'shift_balance')::bigint, 0)
   WHERE id = v_shift;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS cage_transfers_recompute_shift ON public.cage_transfers;
CREATE TRIGGER cage_transfers_recompute_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.cage_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_shift_from_child();

DROP TRIGGER IF EXISTS expenses_recompute_shift ON public.expenses;
CREATE TRIGGER expenses_recompute_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_shift_from_child();

-- 5. Backfill all existing shifts
DO $$
DECLARE
  r RECORD;
  v jsonb;
BEGIN
  FOR r IN SELECT id FROM public.shifts LOOP
    v := public.compute_shift_balance(r.id);
    UPDATE public.shifts
       SET cash_desk_result = COALESCE((v->>'cash_desk_result')::bigint, 0),
           balance          = COALESCE((v->>'shift_balance')::bigint, 0)
     WHERE id = r.id;
  END LOOP;
END $$;