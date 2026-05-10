-- Weekly bonus distribution for Live Game staff (dealers + pit bosses)
-- Sun..Sat week, computed when manager enters pool and presses OK.

CREATE TABLE public.weekly_bonus_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Sunday
  pool_amount BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  is_calculated BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ,
  calculated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, week_start)
);

CREATE TABLE public.weekly_bonus_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Sunday
  extra_override INTEGER, -- if NULL, use computed E count
  bonus_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, dealer_id, week_start)
);

CREATE INDEX idx_weekly_bonus_entries_lookup ON public.weekly_bonus_entries(casino_id, week_start);
CREATE INDEX idx_weekly_bonus_pools_lookup ON public.weekly_bonus_pools(casino_id, week_start);

-- updated_at triggers
CREATE TRIGGER trg_weekly_bonus_pools_updated_at
  BEFORE UPDATE ON public.weekly_bonus_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_weekly_bonus_entries_updated_at
  BEFORE UPDATE ON public.weekly_bonus_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.weekly_bonus_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_bonus_entries ENABLE ROW LEVEL SECURITY;

-- Read: manager / finance_manager / super_admin / surveillance of the casino
CREATE POLICY "weekly_bonus_pools_select"
ON public.weekly_bonus_pools FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'finance_manager')
      OR public.has_role(auth.uid(), 'surveillance')
    )
  )
);

CREATE POLICY "weekly_bonus_pools_write"
ON public.weekly_bonus_pools FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
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
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
);

CREATE POLICY "weekly_bonus_entries_select"
ON public.weekly_bonus_entries FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'finance_manager')
      OR public.has_role(auth.uid(), 'surveillance')
    )
  )
);

CREATE POLICY "weekly_bonus_entries_write"
ON public.weekly_bonus_entries FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager')
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
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  )
);