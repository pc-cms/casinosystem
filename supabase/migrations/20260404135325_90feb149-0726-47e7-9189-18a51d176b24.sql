
-- 1. Tighten player_tags INSERT: only manager/pit can add tags
DROP POLICY IF EXISTS "Users manage tags" ON public.player_tags;
CREATE POLICY "Authorized users manage tags" ON public.player_tags
FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role))
  AND EXISTS (
    SELECT 1 FROM players p
    WHERE p.id = player_tags.player_id AND p.casino_id = get_user_casino_id(auth.uid())
  )
);

-- 2. Tighten players INSERT: only reception/pit/manager can create players
DROP POLICY IF EXISTS "Authorized users create players" ON public.players;
CREATE POLICY "Authorized roles create players" ON public.players
FOR INSERT TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(), 'reception'::app_role) OR has_role(auth.uid(), 'pit'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- 3. Tighten players UPDATE: only reception/pit/manager can update
DROP POLICY IF EXISTS "Authorized users update players" ON public.players;
CREATE POLICY "Authorized roles update players" ON public.players
FOR UPDATE TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(), 'reception'::app_role) OR has_role(auth.uid(), 'pit'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- 4. Tighten expenses INSERT: only cashier/manager can create
DROP POLICY IF EXISTS "Users create expenses" ON public.expenses;
CREATE POLICY "Authorized roles create expenses" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND created_by = auth.uid()
  AND (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- 5. Fix validate_chip_consistency to use business day (5 AM rollover)
CREATE OR REPLACE FUNCTION public.validate_chip_consistency(_casino_id uuid)
RETURNS TABLE(status text, total_expected numeric, total_actual numeric, difference numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_expected numeric;
  v_actual numeric;
  v_business_date date;
  v_shift_end time;
BEGIN
  -- Get casino shift_end to determine business day boundary
  SELECT shift_end::time INTO v_shift_end FROM public.casinos WHERE id = _casino_id;
  IF v_shift_end IS NULL THEN v_shift_end := '05:00'::time; END IF;
  
  -- Business date: if current time < shift_end, use yesterday
  IF CURRENT_TIME < v_shift_end THEN
    v_business_date := CURRENT_DATE - 1;
  ELSE
    v_business_date := CURRENT_DATE;
  END IF;

  SELECT COALESCE(SUM(expected_quantity::numeric * denomination::numeric), 0)
  INTO v_expected
  FROM public.chip_baseline
  WHERE casino_id = _casino_id;

  SELECT COALESCE(SUM(actual_quantity::numeric * denomination::numeric), 0)
  INTO v_actual
  FROM public.chip_snapshots
  WHERE casino_id = _casino_id AND date = v_business_date;

  status := CASE
    WHEN v_actual = 0 THEN 'NO_COUNT'
    WHEN v_actual > v_expected THEN 'INCIDENT'
    WHEN v_actual = v_expected THEN 'PERFECT'
    ELSE 'MISS'
  END;
  total_expected := v_expected;
  total_actual := v_actual;
  difference := v_actual - v_expected;

  RETURN NEXT;
END;
$function$;
