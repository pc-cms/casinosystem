
-- Fix integer overflow: change chip columns from integer to bigint
ALTER TABLE public.chip_baseline ALTER COLUMN expected_quantity TYPE bigint;
ALTER TABLE public.chip_snapshots ALTER COLUMN expected_quantity TYPE bigint;
ALTER TABLE public.chip_snapshots ALTER COLUMN actual_quantity TYPE bigint;
ALTER TABLE public.chip_snapshots ALTER COLUMN miss TYPE bigint;
ALTER TABLE public.chip_inventory ALTER COLUMN quantity TYPE bigint;
ALTER TABLE public.chip_inventory ALTER COLUMN denomination TYPE bigint;
ALTER TABLE public.chip_baseline ALTER COLUMN denomination TYPE bigint;
ALTER TABLE public.chip_snapshots ALTER COLUMN denomination TYPE bigint;

-- Recreate get_expected_chips with bigint
CREATE OR REPLACE FUNCTION public.get_expected_chips(_casino_id uuid, _location_type text, _location_id uuid, _denomination bigint)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT expected_quantity FROM public.chip_baseline
     WHERE casino_id = _casino_id
       AND location_type = _location_type
       AND location_id IS NOT DISTINCT FROM _location_id
       AND denomination = _denomination),
    0
  )::bigint;
$$;

-- Recreate calc_chip_miss trigger function
CREATE OR REPLACE FUNCTION public.calc_chip_miss()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.miss := NEW.actual_quantity - NEW.expected_quantity;
  RETURN NEW;
END;
$$;

-- Recreate validate_chip_consistency with numeric
CREATE OR REPLACE FUNCTION public.validate_chip_consistency(_casino_id uuid)
RETURNS TABLE(status text, total_expected numeric, total_actual numeric, difference numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expected numeric;
  v_actual numeric;
  v_today date := CURRENT_DATE;
BEGIN
  SELECT COALESCE(SUM(expected_quantity::numeric * denomination::numeric), 0)
  INTO v_expected
  FROM public.chip_baseline
  WHERE casino_id = _casino_id;

  SELECT COALESCE(SUM(actual_quantity::numeric * denomination::numeric), 0)
  INTO v_actual
  FROM public.chip_snapshots
  WHERE casino_id = _casino_id AND date = v_today;

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
$$;
