-- ============================================================
-- Closings Hub + Expenses Restructure — Step 1: Backend
-- ============================================================

-- 1.1 Per-casino expense categories ---------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id    uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  scope        text NOT NULL DEFAULT 'any'
                 CHECK (scope IN ('live_game','slots','office','any')),
  active       boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, code)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_casino
  ON public.expense_categories(casino_id, active, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_read"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "expense_categories_write_manager"
  ON public.expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'finance_manager'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  );

CREATE POLICY "expense_categories_update_manager"
  ON public.expense_categories FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'finance_manager'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  );

CREATE POLICY "expense_categories_delete_manager"
  ON public.expense_categories FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role)
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_expense_categories()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_expense_categories ON public.expense_categories;
CREATE TRIGGER trg_touch_expense_categories
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_expense_categories();

-- Seed from existing enum for every casino
INSERT INTO public.expense_categories (casino_id, code, label, scope, sort_order)
SELECT c.id, x.code, x.label, x.scope, x.sort_order
FROM public.casinos c
CROSS JOIN (VALUES
  ('food',      'Food',       'any',       10),
  ('alcohol',   'Alcohol',    'any',       20),
  ('taxi',      'Taxi',       'any',       30),
  ('hotel',     'Hotel',      'any',       40),
  ('flight',    'Flight',     'any',       50),
  ('pos_comp',  'POS Comp',   'any',       60),
  ('bar_charge','Bar Charge', 'any',       70),
  ('other',     'Other',      'any',       99)
) AS x(code, label, scope, sort_order)
ON CONFLICT (casino_id, code) DO NOTHING;

-- 1.2 expenses.source column ---------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'live_game'
    CHECK (source IN ('live_game','slots','office'));

-- Backfill from cage_type / cage_slots_shift_id
UPDATE public.expenses
   SET source = CASE
     WHEN cage_slots_shift_id IS NOT NULL THEN 'slots'
     WHEN cage_type = 'slots'             THEN 'slots'
     ELSE 'live_game'
   END
 WHERE source = 'live_game'; -- only touch defaulted rows; safe re-run

-- Optional category_code (free-form) — allows custom categories beyond enum
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category_code text;

-- Backfill category_code from the enum text
UPDATE public.expenses SET category_code = category::text
 WHERE category_code IS NULL;

-- 1.3 Office expense triggers --------------------------------

-- BEFORE INSERT: auto-approve office expenses, ensure no shift links
CREATE OR REPLACE FUNCTION public.expenses_office_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source = 'office' THEN
    NEW.approved    := true;
    NEW.approved_by := COALESCE(NEW.approved_by, NEW.created_by);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.shift_id            := NULL;
    NEW.cage_slots_shift_id := NULL;
    NEW.cage_type           := 'live_game'; -- keep NOT NULL satisfied (legacy col)
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_expenses_office_before_insert ON public.expenses;
CREATE TRIGGER trg_expenses_office_before_insert
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_office_before_insert();

-- AFTER INSERT: post wallet_transactions debit on MAIN_CASH
CREATE OR REPLACE FUNCTION public.expenses_office_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'office' AND NEW.amount > 0 THEN
    INSERT INTO public.wallet_transactions (
      casino_id, tx_type, from_wallet, to_wallet,
      amount, expense_category, description, operator_id, business_date
    ) VALUES (
      NEW.casino_id,
      'manual_expense'::wallet_tx_type,
      'main_cash'::wallet_type,
      NULL,
      NEW.amount,
      NEW.category,
      'Office expense: ' || COALESCE(NULLIF(NEW.description,''),'(no description)'),
      NEW.created_by,
      COALESCE(NEW.business_date, (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_expenses_office_after_insert ON public.expenses;
CREATE TRIGGER trg_expenses_office_after_insert
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_office_after_insert();

-- 1.4 RPC: create_office_expense -----------------------------
CREATE OR REPLACE FUNCTION public.create_office_expense(
  p_casino_id     uuid,
  p_category_code text,
  p_amount        numeric,
  p_description   text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_cat expense_category;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (
       public.has_role(v_uid,'manager'::app_role)
    OR public.has_role(v_uid,'finance_manager'::app_role)
    OR public.has_role(v_uid,'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'manager role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Validate category exists for this casino with scope office/any
  PERFORM 1 FROM public.expense_categories
   WHERE casino_id = p_casino_id
     AND code = p_category_code
     AND active = true
     AND scope IN ('office','any');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'category % not available for office', p_category_code;
  END IF;

  -- Map to existing enum (fallback 'other' for custom codes)
  BEGIN
    v_cat := p_category_code::expense_category;
  EXCEPTION WHEN others THEN
    v_cat := 'other'::expense_category;
  END;

  INSERT INTO public.expenses (
    casino_id, category, category_code, amount, description,
    player_name, created_by, cage_type, source,
    business_date
  ) VALUES (
    p_casino_id, v_cat, p_category_code, p_amount, COALESCE(p_description,''),
    '', v_uid, 'live_game', 'office',
    (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_office_expense(uuid,text,numeric,text) TO authenticated;