
-- Budget categories (reusable across budget, expenses, reports)
CREATE TABLE public.budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  name text NOT NULL,
  parent_group text NOT NULL,
  expense_mapping text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(casino_id, name)
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see budget categories" ON public.budget_categories
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Finance managers insert budget categories" ON public.budget_categories
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Finance managers update budget categories" ON public.budget_categories
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'finance_manager'::app_role));

-- Validate parent_group via trigger
CREATE OR REPLACE FUNCTION public.validate_budget_category_group()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_group NOT IN ('operating', 'fixed', 'government', 'tech', 'other') THEN
    RAISE EXCEPTION 'Invalid parent_group: %', NEW.parent_group;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_budget_category_group_trigger
  BEFORE INSERT OR UPDATE ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_category_group();

-- Budget periods (monthly budget containers with lock)
CREATE TABLE public.budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  month text NOT NULL,
  is_locked boolean NOT NULL DEFAULT true,
  locked_by uuid,
  unlocked_by uuid,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, month)
);

ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see budget periods" ON public.budget_periods
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Fm/managers insert budget periods" ON public.budget_periods
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Finance managers update budget periods" ON public.budget_periods
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'finance_manager'::app_role));

CREATE TRIGGER update_budget_periods_updated_at
  BEFORE UPDATE ON public.budget_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Budget items (individual line items in a period)
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  period_id uuid NOT NULL REFERENCES public.budget_periods(id),
  category_id uuid NOT NULL REFERENCES public.budget_categories(id),
  item_name text NOT NULL,
  logic_type text NOT NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric NOT NULL DEFAULT 0,
  reserved_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see budget items" ON public.budget_items
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Fm/managers insert budget items" ON public.budget_items
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Fm/managers update budget items" ON public.budget_items
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

-- Validate budget item fields via trigger
CREATE OR REPLACE FUNCTION public.validate_budget_item()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.logic_type NOT IN ('reserve', 'direct_expense') THEN
    RAISE EXCEPTION 'Invalid logic_type: %', NEW.logic_type;
  END IF;
  IF NEW.status NOT IN ('planned', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.monthly_amount < 0 THEN
    RAISE EXCEPTION 'Monthly amount cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_budget_item_trigger
  BEFORE INSERT OR UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_item();

CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Budget logs (immutable audit trail)
CREATE TABLE public.budget_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  period_id uuid REFERENCES public.budget_periods(id),
  item_id uuid REFERENCES public.budget_items(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  operator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see budget logs" ON public.budget_logs
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Fm/managers insert budget logs" ON public.budget_logs
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND operator_id = auth.uid() AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

-- Immutable budget logs
CREATE OR REPLACE FUNCTION public.prevent_budget_log_modify()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Budget logs are immutable';
END;
$$;

CREATE TRIGGER prevent_budget_log_update_delete
  BEFORE UPDATE OR DELETE ON public.budget_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_budget_log_modify();
