
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
  v_cashout      bigint := 0;
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

  SELECT
    COALESCE(SUM(CASE WHEN t.type IN ('buy','in') THEN t.amount ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN t.type IN ('cashout','out') THEN t.amount ELSE 0 END), 0)::bigint
  INTO v_drop_total, v_cashout
  FROM public.transactions t
  JOIN public.promo_campaign_players pcp ON pcp.player_id = t.player_id
  WHERE pcp.campaign_id = _campaign_id
    AND t.business_date >= v_campaign.starts_on
    AND (v_campaign.ends_on IS NULL OR t.business_date <= v_campaign.ends_on);

  v_nep_total := v_drop_total - v_cashout;

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
    'cashout_total_tzs', v_cashout,
    'nep_total_tzs',   v_nep_total,
    'roi_pct',         v_roi_pct,
    'cac_per_player_tzs', v_cac
  );
END;
$$;
