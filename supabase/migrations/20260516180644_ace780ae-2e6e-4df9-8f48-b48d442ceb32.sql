
-- Monthly Tips: mirror of Weekly Bonus but period = 16th of previous month .. 15th of current month.
-- period_start is always the 16th (anchor day).

CREATE TABLE public.monthly_tips_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  pool_amount BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  is_calculated BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ,
  calculated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, period_start)
);

CREATE TABLE public.monthly_tips_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  extra_override INTEGER,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, employee_id, period_start)
);

-- Enforce that period_start is always the 16th
ALTER TABLE public.monthly_tips_pools
  ADD CONSTRAINT monthly_tips_pools_period_is_16th CHECK (EXTRACT(DAY FROM period_start) = 16);
ALTER TABLE public.monthly_tips_entries
  ADD CONSTRAINT monthly_tips_entries_period_is_16th CHECK (EXTRACT(DAY FROM period_start) = 16);

CREATE INDEX idx_monthly_tips_pools_lookup ON public.monthly_tips_pools(casino_id, period_start);
CREATE INDEX idx_monthly_tips_entries_lookup ON public.monthly_tips_entries(casino_id, period_start);
CREATE INDEX idx_monthly_tips_entries_employee ON public.monthly_tips_entries(casino_id, employee_id, period_start);

CREATE TRIGGER trg_monthly_tips_pools_updated_at
  BEFORE UPDATE ON public.monthly_tips_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_monthly_tips_entries_updated_at
  BEFORE UPDATE ON public.monthly_tips_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_tips_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_tips_entries ENABLE ROW LEVEL SECURITY;

-- Pools: read (manager / floor_manager / finance_manager / surveillance / super_admin)
CREATE POLICY "monthly_tips_pools_select"
ON public.monthly_tips_pools FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
      OR public.has_role(auth.uid(), 'surveillance')
    )
  )
);

CREATE POLICY "monthly_tips_pools_write"
ON public.monthly_tips_pools FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
);

CREATE POLICY "monthly_tips_entries_select"
ON public.monthly_tips_entries FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
      OR public.has_role(auth.uid(), 'surveillance')
    )
  )
);

CREATE POLICY "monthly_tips_entries_write"
ON public.monthly_tips_entries FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_tips_pools;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_tips_entries;

-- Register module + role defaults (mirror weekly_bonus)
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('manager','monthly_tips',true,true,'all'),
  ('floor_manager','monthly_tips',true,true,'all'),
  ('finance_manager','monthly_tips',true,true,'all'),
  ('super_admin','monthly_tips',true,true,'all')
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      day_horizon = EXCLUDED.day_horizon;
