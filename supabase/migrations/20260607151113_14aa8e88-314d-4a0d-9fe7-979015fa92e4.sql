
-- 1. expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  scope text NOT NULL DEFAULT 'any' CHECK (scope IN ('live_game','slots','office','any')),
  fin_category_id uuid REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, code, scope)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY ec_read ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY ec_write ON public.expense_categories
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'finance_manager'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'finance_manager'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  );

CREATE TRIGGER trg_ec_upd BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

-- 2. Seed default per-casino cashier categories for every casino, both live_game and slots
DO $$
DECLARE
  v_casino RECORD;
  v_food   uuid := (SELECT id FROM public.fin_categories WHERE name='Food for Customers & Staff' LIMIT 1);
  v_bar    uuid := (SELECT id FROM public.fin_categories WHERE name='Bar' LIMIT 1);
  v_taxi   uuid := (SELECT id FROM public.fin_categories WHERE name='Transport for Staff' LIMIT 1);
  v_other  uuid := (SELECT id FROM public.fin_categories WHERE name='Other Variable Expenses' LIMIT 1);
  v_scope  text;
BEGIN
  FOR v_casino IN SELECT id FROM public.casinos LOOP
    FOREACH v_scope IN ARRAY ARRAY['live_game','slots','office'] LOOP
      INSERT INTO public.expense_categories (casino_id, code, label, scope, fin_category_id, sort_order) VALUES
        (v_casino.id, 'food',       'Food',       v_scope, v_food,  10),
        (v_casino.id, 'alcohol',    'Alcohol',    v_scope, v_bar,   20),
        (v_casino.id, 'bar_charge', 'Bar charge', v_scope, v_bar,   30),
        (v_casino.id, 'taxi',       'Taxi',       v_scope, v_taxi,  40),
        (v_casino.id, 'other',      'Other',      v_scope, v_other, 90)
      ON CONFLICT (casino_id, code, scope) DO UPDATE SET
        fin_category_id = COALESCE(public.expense_categories.fin_category_id, EXCLUDED.fin_category_id),
        label = EXCLUDED.label;
    END LOOP;
  END LOOP;
END $$;

-- 3. Populate global aliases for legacy codes (alias_norm is globally unique)
INSERT INTO public.fin_category_aliases (alias_norm, alias_original, category_id)
SELECT v.code, v.code, v.fin_id FROM (VALUES
  ('food',       (SELECT id FROM public.fin_categories WHERE name='Food for Customers & Staff' LIMIT 1)),
  ('alcohol',    (SELECT id FROM public.fin_categories WHERE name='Bar' LIMIT 1)),
  ('bar_charge', (SELECT id FROM public.fin_categories WHERE name='Bar' LIMIT 1)),
  ('pos_comp',   (SELECT id FROM public.fin_categories WHERE name='Bar' LIMIT 1)),
  ('taxi',       (SELECT id FROM public.fin_categories WHERE name='Transport for Staff' LIMIT 1)),
  ('flight',     (SELECT id FROM public.fin_categories WHERE name='Other Variable Expenses' LIMIT 1)),
  ('hotel',      (SELECT id FROM public.fin_categories WHERE name='Other Variable Expenses' LIMIT 1)),
  ('other',      (SELECT id FROM public.fin_categories WHERE name='Other Variable Expenses' LIMIT 1))
) AS v(code, fin_id)
WHERE v.fin_id IS NOT NULL
ON CONFLICT (alias_norm) DO UPDATE SET category_id = EXCLUDED.category_id;

-- 4. Trigger on expenses to auto-resolve fin_category_id
CREATE OR REPLACE FUNCTION public.expense_resolve_fin_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fin uuid;
BEGIN
  IF NEW.fin_category_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try per-casino expense_categories by category_code OR category enum
  SELECT ec.fin_category_id INTO v_fin
    FROM public.expense_categories ec
   WHERE ec.casino_id = NEW.casino_id
     AND ec.active = true
     AND ec.code = COALESCE(NEW.category_code, NEW.category::text)
   ORDER BY (ec.scope = NEW.source) DESC, ec.sort_order
   LIMIT 1;

  IF v_fin IS NULL THEN
    -- Global alias fallback by legacy enum value or code
    SELECT a.category_id INTO v_fin
      FROM public.fin_category_aliases a
     WHERE a.alias_norm = COALESCE(NEW.category_code, NEW.category::text)
     LIMIT 1;
  END IF;

  NEW.fin_category_id := v_fin;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_expense_resolve_fin_category ON public.expenses;
CREATE TRIGGER trg_expense_resolve_fin_category
  BEFORE INSERT OR UPDATE OF category, category_code ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expense_resolve_fin_category();

-- 5. One-shot backfill for existing rows missing fin_category_id
UPDATE public.expenses e
   SET fin_category_id = sub.fin_id
  FROM (
    SELECT id, COALESCE(
      (SELECT a.category_id FROM public.fin_category_aliases a WHERE a.alias_norm = COALESCE(category_code, category::text) LIMIT 1)
    ) AS fin_id
      FROM public.expenses
     WHERE fin_category_id IS NULL
  ) sub
 WHERE e.id = sub.id
   AND sub.fin_id IS NOT NULL;
