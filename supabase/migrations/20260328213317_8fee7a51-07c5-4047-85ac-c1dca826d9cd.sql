
-- ===== 3. CHIP BASELINE TABLE (fixed PK) =====
CREATE TABLE IF NOT EXISTS public.chip_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  location_type text NOT NULL,
  location_id uuid,
  denomination integer NOT NULL,
  expected_quantity integer NOT NULL DEFAULT 0,
  UNIQUE (casino_id, location_type, location_id, denomination)
);

ALTER TABLE public.chip_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see chip baseline"
ON public.chip_baseline FOR SELECT TO authenticated
USING (casino_id = public.get_user_casino_id(auth.uid()));

CREATE POLICY "Managers manage chip baseline"
ON public.chip_baseline FOR INSERT TO authenticated
WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers update chip baseline"
ON public.chip_baseline FOR UPDATE TO authenticated
USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.get_expected_chips(
  _casino_id uuid,
  _location_type text,
  _location_id uuid,
  _denomination integer
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT expected_quantity FROM public.chip_baseline
     WHERE casino_id = _casino_id
       AND location_type = _location_type
       AND location_id IS NOT DISTINCT FROM _location_id
       AND denomination = _denomination),
    0
  );
$$;

-- ===== 4. SHIFT RESULT STORED AS COLUMNS =====
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS cash_result numeric;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS miss_total numeric;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shift_result numeric;

-- ===== 5. DB-LEVEL TRANSACTION LOGGING =====
CREATE OR REPLACE FUNCTION public.auto_log_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id,
    'transaction',
    CASE WHEN NEW.type = 'buy' THEN 'BUY_IN' ELSE 'CASHOUT' END,
    NEW.operator_id,
    jsonb_build_object(
      'transaction_id', NEW.id,
      'player_id', NEW.player_id,
      'amount', NEW.amount,
      'table_id', NEW.table_id,
      'shift_id', NEW.shift_id,
      'source', 'db_trigger'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_log_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_log_transaction();

-- ===== 6. GLOBAL CHIP CONSISTENCY CHECK =====
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
$$
