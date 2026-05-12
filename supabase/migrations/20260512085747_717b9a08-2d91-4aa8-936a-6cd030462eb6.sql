CREATE OR REPLACE FUNCTION public.shift_miss_total_from_closing_count(_closing_count jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN COALESCE(_closing_count->>'chip_miss_total', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN -((_closing_count->>'chip_miss_total')::numeric)::bigint
    ELSE 0::bigint
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.shift_miss_total_from_closing_count(jsonb) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.compute_shift_balance_from_row(s public.shifts)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
   WHERE shift_id = s.id;

  SELECT
    COALESCE(SUM(CASE WHEN transfer_type = 'add_float'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'collection' THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'slots_in'   THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'slots_out'  THEN amount END), 0)::bigint
  INTO v_add_float, v_collection, v_slots_in, v_slots_out
  FROM public.cage_transfers
  WHERE shift_id = s.id;

  v_miss := COALESCE(s.miss_total, public.shift_miss_total_from_closing_count(s.closing_count), 0)::bigint;
  v_tables := COALESCE(s.tables_result, 0)::bigint;

  v_cash_desk := v_delta_cash + v_expenses + v_collection - v_add_float + v_slots_out - v_slots_in;
  v_balance := v_cash_desk - v_tables - v_miss;

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

GRANT EXECUTE ON FUNCTION public.compute_shift_balance_from_row(public.shifts) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.compute_shift_balance(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.shifts%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'shift_not_found');
  END IF;

  RETURN public.compute_shift_balance_from_row(s);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shift_balance(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.trg_shifts_recompute_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NEW.status = 'closed' AND NEW.closing_count IS NOT NULL THEN
    NEW.miss_total := public.shift_miss_total_from_closing_count(NEW.closing_count);
  END IF;

  v := public.compute_shift_balance_from_row(NEW);
  NEW.cash_desk_result := COALESCE((v->>'cash_desk_result')::bigint, 0);
  NEW.balance := COALESCE((v->>'shift_balance')::bigint, 0);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shifts_recompute_balance ON public.shifts;
CREATE TRIGGER shifts_recompute_balance
  BEFORE INSERT OR UPDATE OF status, opening_float, closing_count, closing_cash, miss_total, tables_result
  ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shifts_recompute_balance();

CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shift            RECORD;
  v_total_in         numeric := 0;
  v_total_out        numeric := 0;
  v_total_exp        numeric := 0;
  v_opening_total    numeric := 0;
  v_opening_chips    numeric := 0;
  v_opening_cash     numeric := 0;
  v_expected         numeric := 0;
  v_miss_total       bigint := 0;
  v_tables_res       numeric := 0;
  v_cash_result      numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift not found: %', p_shift_id;
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_total_in
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('buy','in');

  SELECT COALESCE(SUM(amount),0) INTO v_total_out
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('cashout','out');

  SELECT COALESCE(SUM(amount),0) INTO v_total_exp
    FROM public.expenses
   WHERE shift_id = p_shift_id;

  v_opening_total := COALESCE(((v_shift.opening_float -> 'totals' ->> 'total_tzs'))::numeric, 0);
  v_opening_chips := COALESCE(((v_shift.opening_float -> 'totals' ->> 'chips_tzs'))::numeric, 0);
  v_opening_cash := GREATEST(v_opening_total - v_opening_chips, 0);

  v_expected := v_opening_cash + v_total_in - v_total_out - v_total_exp;
  v_cash_result := v_total_in - v_total_out;
  v_miss_total := public.shift_miss_total_from_closing_count(v_shift.closing_count);
  v_tables_res := COALESCE(v_shift.tables_result, v_shift.shift_result, 0);

  RETURN jsonb_build_object(
    'shift_id',       p_shift_id,
    'opening_float',  v_opening_total,
    'opening_cash',   v_opening_cash,
    'opening_chips',  v_opening_chips,
    'total_in',       v_total_in,
    'total_out',      v_total_out,
    'total_expenses', v_total_exp,
    'expected_cash',  v_expected,
    'cash_result',    v_cash_result,
    'miss_total',     v_miss_total,
    'tables_result',  v_tables_res,
    'shift_result',   v_tables_res
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shift_close(uuid) TO authenticated;