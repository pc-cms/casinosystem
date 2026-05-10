-- Drop the obsolete miss_chips table, its trigger, and rebuild compute_shift_close
-- to use only closing_count.chip_miss_total as the single source of truth for Miss.

-- 1. Drop trigger that auto-populated miss_chips on shift close
DROP TRIGGER IF EXISTS trg_finalize_floor_on_shift_close ON public.shifts;
DROP FUNCTION IF EXISTS public.finalize_floor_to_miss_chips() CASCADE;

-- 2. Drop immutability triggers + table (CASCADE drops chip_conservation_status view)
DROP TRIGGER IF EXISTS trg_prevent_miss_chips_update ON public.miss_chips;
DROP TRIGGER IF EXISTS trg_prevent_miss_chips_delete ON public.miss_chips;
DROP FUNCTION IF EXISTS public.prevent_miss_chips_modify() CASCADE;
DROP TABLE IF EXISTS public.miss_chips CASCADE;

-- 3. Recreate chip_conservation_status without miss_chips
-- Floor = Initial - InLocations (no archived bucket anymore)
CREATE VIEW public.chip_conservation_status
WITH (security_invoker = true) AS
SELECT
  cib.casino_id,
  cib.denomination,
  cib.initial_quantity,
  COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
            WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0) AS in_locations,
  0::numeric AS archived_miss,
  cib.initial_quantity
    - COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
                WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0) AS live_floor
FROM public.chip_initial_baseline cib;

-- 4. Rewrite compute_shift_close: Miss = closing_count->>'chip_miss_total'
CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shift        RECORD;
  v_total_in     numeric := 0;
  v_total_out    numeric := 0;
  v_total_exp    numeric := 0;
  v_opening      numeric := 0;
  v_expected     numeric := 0;
  v_miss_total   numeric := 0;
  v_tables_res   numeric := 0;
  v_cash_result  numeric := 0;
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

  v_opening     := COALESCE(((v_shift.opening_float -> 'totals' ->> 'total_tzs'))::numeric, 0);
  v_expected    := v_opening + v_total_in - v_total_out - v_total_exp;
  v_cash_result := v_total_in - v_total_out;

  -- Miss = ONLY the cage chip count delta written into closing_count.chip_miss_total
  v_miss_total := COALESCE((v_shift.closing_count ->> 'chip_miss_total')::numeric, 0);

  BEGIN
    SELECT COALESCE(SUM(result),0) INTO v_tables_res
      FROM public.gaming_tables_history
     WHERE shift_id = p_shift_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_tables_res := 0;
  END;

  RETURN jsonb_build_object(
    'shift_id',       p_shift_id,
    'opening_float',  v_opening,
    'total_in',       v_total_in,
    'total_out',      v_total_out,
    'total_expenses', v_total_exp,
    'expected_cash',  v_expected,
    'cash_result',    v_cash_result,
    'miss_total',     v_miss_total,
    'tables_result',  v_tables_res,
    'shift_result',   v_cash_result + v_miss_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shift_close(uuid) TO authenticated;

-- 5. Backfill historical closed shifts so Cage Closings reflects the correct Miss
UPDATE public.shifts
   SET miss_total   = COALESCE((closing_count ->> 'chip_miss_total')::numeric, 0),
       shift_result = COALESCE(cash_result, 0) + COALESCE((closing_count ->> 'chip_miss_total')::numeric, 0)
 WHERE status = 'closed';