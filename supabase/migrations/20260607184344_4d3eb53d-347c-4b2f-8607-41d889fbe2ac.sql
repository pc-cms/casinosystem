-- fin_incomes: dedicated table for Other Incomes (separates from expenses.is_income hack)
CREATE TABLE IF NOT EXISTS public.fin_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  fin_category_id uuid NOT NULL REFERENCES public.fin_categories(id) ON DELETE RESTRICT,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  currency text NOT NULL DEFAULT 'TZS' CHECK (currency IN ('TZS','USD','EUR','GBP','KES')),
  amount numeric(20,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, fin_category_id, year, month, currency)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_incomes TO authenticated;
GRANT ALL ON public.fin_incomes TO service_role;

ALTER TABLE public.fin_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view incomes"
  ON public.fin_incomes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_manager')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'floor_manager')
  );

CREATE POLICY "Finance can write incomes"
  ON public.fin_incomes FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_manager')
  );

CREATE INDEX IF NOT EXISTS idx_fin_incomes_casino_year ON public.fin_incomes(casino_id, year);

CREATE TRIGGER trg_fin_incomes_updated_at
  BEFORE UPDATE ON public.fin_incomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
