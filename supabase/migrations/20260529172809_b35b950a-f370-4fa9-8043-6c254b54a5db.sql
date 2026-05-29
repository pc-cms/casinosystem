
-- ============================================================================
-- G3 · Marketing / Promo Budgets
-- ============================================================================
-- Three tables to track marketing campaigns, their expenses, and which players
-- they attracted. KPI RPC aggregates spend vs attributed player drop/NEP/ROI.
-- ============================================================================

CREATE TYPE public.promo_campaign_type AS ENUM (
  'event','bonus','advertising','sponsorship','other'
);

CREATE TYPE public.promo_campaign_status AS ENUM (
  'planned','active','completed','cancelled'
);

-- ---------- promo_campaigns ----------
CREATE TABLE public.promo_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id       uuid NOT NULL,
  name            text NOT NULL,
  campaign_type   public.promo_campaign_type NOT NULL DEFAULT 'event',
  status          public.promo_campaign_status NOT NULL DEFAULT 'planned',
  starts_on       date NOT NULL,
  ends_on         date,
  budget_tzs      bigint NOT NULL DEFAULT 0,
  description     text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_campaigns TO authenticated;
GRANT ALL ON public.promo_campaigns TO service_role;
ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_campaigns_select_by_casino" ON public.promo_campaigns
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.casino_id = promo_campaigns.casino_id
    )
  );

CREATE POLICY "promo_campaigns_write_managers" ON public.promo_campaigns
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  );

CREATE INDEX idx_promo_campaigns_casino_dates
  ON public.promo_campaigns(casino_id, starts_on DESC);

-- ---------- promo_campaign_expenses ----------
CREATE TABLE public.promo_campaign_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  casino_id       uuid NOT NULL,
  spent_on        date NOT NULL DEFAULT CURRENT_DATE,
  amount_tzs      bigint NOT NULL CHECK (amount_tzs >= 0),
  vendor          text,
  description     text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_campaign_expenses TO authenticated;
GRANT ALL ON public.promo_campaign_expenses TO service_role;
ALTER TABLE public.promo_campaign_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_expenses_select_by_casino" ON public.promo_campaign_expenses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.casino_id = promo_campaign_expenses.casino_id
    )
  );

CREATE POLICY "promo_expenses_write_managers" ON public.promo_campaign_expenses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  );

CREATE INDEX idx_promo_expenses_campaign ON public.promo_campaign_expenses(campaign_id);

-- ---------- promo_campaign_players ----------
CREATE TABLE public.promo_campaign_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL,
  casino_id       uuid NOT NULL,
  attributed_on   date NOT NULL DEFAULT CURRENT_DATE,
  note            text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_campaign_players TO authenticated;
GRANT ALL ON public.promo_campaign_players TO service_role;
ALTER TABLE public.promo_campaign_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_players_select_by_casino" ON public.promo_campaign_players
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.casino_id = promo_campaign_players.casino_id
    )
  );

CREATE POLICY "promo_players_write_managers" ON public.promo_campaign_players
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  );

CREATE INDEX idx_promo_players_campaign ON public.promo_campaign_players(campaign_id);
CREATE INDEX idx_promo_players_player ON public.promo_campaign_players(player_id);

-- ---------- updated_at trigger ----------
CREATE TRIGGER trg_promo_campaigns_updated
  BEFORE UPDATE ON public.promo_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RPC: promo_campaign_kpi(_campaign_id uuid)
-- Returns JSONB with: spent, budget, utilization_pct, players, drop_total,
-- nep_total, roi_pct, cac (per-player), starts_on, ends_on.
-- Player drop/NEP is summed from visits within campaign date range,
-- only for players attributed to the campaign.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.promo_campaign_kpi(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign     public.promo_campaigns;
  v_spent        bigint := 0;
  v_players      int := 0;
  v_drop_total   bigint := 0;
  v_nep_total    bigint := 0;
  v_roi_pct      numeric := 0;
  v_util_pct     numeric := 0;
  v_cac          bigint := 0;
BEGIN
  SELECT * INTO v_campaign FROM public.promo_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','campaign_not_found');
  END IF;

  SELECT COALESCE(SUM(amount_tzs),0) INTO v_spent
    FROM public.promo_campaign_expenses
    WHERE campaign_id = _campaign_id;

  SELECT COUNT(*) INTO v_players
    FROM public.promo_campaign_players
    WHERE campaign_id = _campaign_id;

  -- Aggregate drop/NEP from visits in campaign window
  SELECT
    COALESCE(SUM(v.drop_tzs),0),
    COALESCE(SUM(v.nep_tzs),0)
  INTO v_drop_total, v_nep_total
  FROM public.visits v
  JOIN public.promo_campaign_players pcp ON pcp.player_id = v.player_id
  WHERE pcp.campaign_id = _campaign_id
    AND v.business_date >= v_campaign.starts_on
    AND (v_campaign.ends_on IS NULL OR v.business_date <= v_campaign.ends_on);

  IF v_campaign.budget_tzs > 0 THEN
    v_util_pct := ROUND((v_spent::numeric / v_campaign.budget_tzs::numeric) * 100, 1);
  END IF;

  IF v_spent > 0 THEN
    v_roi_pct := ROUND(((v_nep_total - v_spent)::numeric / v_spent::numeric) * 100, 1);
  END IF;

  IF v_players > 0 THEN
    v_cac := v_spent / v_players;
  END IF;

  RETURN jsonb_build_object(
    'campaign_id',     v_campaign.id,
    'name',            v_campaign.name,
    'campaign_type',   v_campaign.campaign_type,
    'status',          v_campaign.status,
    'starts_on',       v_campaign.starts_on,
    'ends_on',         v_campaign.ends_on,
    'budget_tzs',      v_campaign.budget_tzs,
    'spent_tzs',       v_spent,
    'utilization_pct', v_util_pct,
    'players_count',   v_players,
    'drop_total_tzs',  v_drop_total,
    'nep_total_tzs',   v_nep_total,
    'roi_pct',         v_roi_pct,
    'cac_per_player_tzs', v_cac
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promo_campaign_kpi(uuid) TO authenticated;

-- ============================================================================
-- Module catalog registration: add "marketing" to access matrix defaults
-- managers/super_admin/finance_manager get can_view=true by default.
-- ============================================================================
INSERT INTO public.role_module_defaults (role, module_key, can_view)
VALUES
  ('super_admin','marketing', true),
  ('manager','marketing', true),
  ('finance_manager','marketing', true)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view;
