CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  v_miss_total       numeric := 0;
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
  v_opening_cash  := GREATEST(v_opening_total - v_opening_chips, 0);

  -- Expected CASH only (no chips). Chip differences are reported as Miss.
  v_expected      := v_opening_cash + v_total_in - v_total_out - v_total_exp;
  v_cash_result   := v_total_in - v_total_out;

  v_miss_total    := COALESCE((v_shift.closing_count ->> 'chip_miss_total')::numeric, 0);

  BEGIN
    SELECT COALESCE(SUM(result),0) INTO v_tables_res
      FROM public.gaming_tables_history
     WHERE shift_id = p_shift_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_tables_res := 0;
  END;

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
    -- shift_result is now Tables Result (real shift P&L)
    'shift_result',   v_tables_res
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shift_close(uuid) TO authenticated;

-- Backfill historical closed shifts so Cage Closings displays the real Tables Result
UPDATE public.shifts
   SET shift_result = COALESCE(
         (closing_cash ->> 'result_table')::numeric,
         (closing_count ->> 'result_table')::numeric,
         0
       )
 WHERE status = 'closed';