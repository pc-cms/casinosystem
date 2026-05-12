-- Fix Cash Desk Balance formula: separate Miss from Cash Desk Result.
--   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn
--   Shift Balance    = Cash Desk Result − Tables Result − Miss   (= 0 when balanced)

CREATE OR REPLACE FUNCTION public.compute_shift_balance(_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_op_total := COALESCE((s.opening_float->'totals'->>'total_tzs')::bigint, 0);
  v_op_chips := COALESCE((s.opening_float->'totals'->>'chips_tzs')::bigint, 0);
  v_opening_cash := GREATEST(v_op_total - v_op_chips, 0);

  v_cl_total := COALESCE((s.closing_count->'totals'->>'total_tzs')::bigint, 0);
  v_cl_chips := COALESCE((s.closing_count->'totals'->>'chips_tzs')::bigint, 0);
  v_closing_cash := GREATEST(v_cl_total - v_cl_chips, 0);

  v_delta_cash := v_closing_cash - v_opening_cash;

  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses
    FROM public.expenses
   WHERE shift_id = _shift_id;

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

  -- Canonical formula (Miss as separate balance term):
  --   Cash Desk Result = ΔCash + Expenses + Collection − AddFloat + SlotsOut − SlotsIn
  --   Shift Balance    = Cash Desk Result − Tables Result − Miss   (= 0 ideal)
  v_cash_desk := v_delta_cash + v_expenses + v_collection - v_add_float + v_slots_out - v_slots_in;
  v_balance   := v_cash_desk - v_tables - v_miss;

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
$function$;

-- Recalculate cash_desk_result and balance for ALL existing shifts using the new formula.
DO $$
DECLARE r RECORD; j jsonb;
BEGIN
  FOR r IN SELECT id FROM public.shifts LOOP
    j := public.compute_shift_balance(r.id);
    IF (j ? 'cash_desk_result') THEN
      UPDATE public.shifts
         SET cash_desk_result = (j->>'cash_desk_result')::bigint,
             balance          = (j->>'shift_balance')::bigint
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;