-- P3: Comp budget hard limits + manager override audit

CREATE TABLE IF NOT EXISTS public.pos_comp_budget_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  tab_id uuid NOT NULL REFERENCES public.pos_tabs(id),
  month_start date NOT NULL,
  amount_tzs bigint NOT NULL CHECK (amount_tzs >= 0),
  manager_user_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pos_comp_budget_overrides TO authenticated;
GRANT ALL ON public.pos_comp_budget_overrides TO service_role;

ALTER TABLE public.pos_comp_budget_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcbo_select" ON public.pos_comp_budget_overrides FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'pos_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
);

CREATE POLICY "pcbo_insert" ON public.pos_comp_budget_overrides FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_see_casino(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE INDEX IF NOT EXISTS idx_pcbo_casino_month
  ON public.pos_comp_budget_overrides (casino_id, month_start DESC);
CREATE INDEX IF NOT EXISTS idx_pcbo_tab ON public.pos_comp_budget_overrides (tab_id);

ALTER TABLE public.pos_tabs
  ADD COLUMN IF NOT EXISTS comp_override_id uuid REFERENCES public.pos_comp_budget_overrides(id);

-- Trigger: block close if comp budget would be exceeded (unless override attached)
CREATE OR REPLACE FUNCTION public.pos_tabs_before_close_check_comp_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_h bigint;
  v_month date;
  v_next  date;
  v_limit bigint := 0;
  v_used  bigint := 0;
BEGIN
  IF NOT (OLD.status = 'open' AND NEW.status = 'closed') THEN
    RETURN NEW;
  END IF;

  v_comp_h := COALESCE((NEW.payment_split->>'comp_house')::bigint, 0);
  IF v_comp_h <= 0 THEN
    RETURN NEW;
  END IF;

  -- Resolve month from business_date (fallback to today EAT)
  v_month := date_trunc(
    'month',
    COALESCE(NEW.business_date, (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date)
  )::date;
  v_next := (v_month + INTERVAL '1 month')::date;

  SELECT COALESCE(limit_tzs, 0) INTO v_limit
  FROM pos_comp_budgets
  WHERE casino_id = NEW.casino_id AND month_start = v_month;

  IF v_limit <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sum house-comp already closed this month (excluding this tab)
  SELECT COALESCE(SUM(COALESCE((t.payment_split->>'comp_house')::bigint, 0)), 0)
  INTO v_used
  FROM pos_tabs t
  WHERE t.casino_id = NEW.casino_id
    AND t.status = 'closed'
    AND t.business_date >= v_month
    AND t.business_date <  v_next
    AND t.id <> NEW.id;

  IF (v_used + v_comp_h) > v_limit AND NEW.comp_override_id IS NULL THEN
    RAISE EXCEPTION 'COMP_BUDGET_EXCEEDED: monthly house-comp budget would be exceeded (used % + this % > limit %)',
      v_used, v_comp_h, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pos_tabs_before_close_check_comp_budget ON public.pos_tabs;
CREATE TRIGGER trg_pos_tabs_before_close_check_comp_budget
BEFORE UPDATE ON public.pos_tabs
FOR EACH ROW EXECUTE FUNCTION public.pos_tabs_before_close_check_comp_budget();