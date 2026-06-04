
CREATE OR REPLACE FUNCTION public.redeem_promo_fifo(
  p_player_id uuid,
  p_casino_id uuid,
  p_amount bigint,
  p_cage_id uuid,
  p_cashier_id uuid,
  p_shift_id uuid,
  p_payout_type text DEFAULT 'chips'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := public.get_current_business_date(p_casino_id);
  v_remaining bigint := p_amount;
  v_grant record;
  v_take bigint;
  v_breakdown jsonb := '[]'::jsonb;
  v_red_id uuid;
  v_cap bigint;
  v_spent_today bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT daily_cap_credits INTO v_cap
  FROM public.club_daily_spend_limits
  WHERE casino_id = p_casino_id AND effective_from <= v_today
  ORDER BY effective_from DESC LIMIT 1;

  IF v_cap IS NOT NULL THEN
    SELECT COALESCE(SUM(amount),0) INTO v_spent_today
    FROM public.promo_redemptions
    WHERE casino_id = p_casino_id AND created_at::date = v_today;
    IF v_spent_today + p_amount > v_cap THEN
      RAISE EXCEPTION 'Daily promo spend cap exceeded (%/%)', v_spent_today + p_amount, v_cap;
    END IF;
  END IF;

  INSERT INTO public.promo_redemptions(player_id, casino_id, cage_id, cashier_id, shift_id, amount, grant_breakdown, payout_type)
  VALUES (p_player_id, p_casino_id, p_cage_id, p_cashier_id, p_shift_id, p_amount, '[]'::jsonb, p_payout_type)
  RETURNING id INTO v_red_id;

  FOR v_grant IN
    SELECT id, remaining, expires_business_date
    FROM public.promo_grants
    WHERE player_id = p_player_id AND status = 'active' AND remaining > 0
      AND (expires_business_date IS NULL OR expires_business_date >= v_today)
    ORDER BY (expires_business_date IS NULL), expires_business_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_grant.remaining, v_remaining);
    UPDATE public.promo_grants
       SET remaining = remaining - v_take,
           status = CASE WHEN remaining - v_take = 0 THEN 'exhausted'::promo_grant_status ELSE status END,
           updated_at = now()
     WHERE id = v_grant.id;
    INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
    VALUES (v_grant.id, p_player_id, -v_take, 'redeem', 'promo_redemption', v_red_id, v_today, p_cashier_id);
    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object('grant_id', v_grant.id, 'amount', v_take, 'expires', v_grant.expires_business_date));
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN RAISE EXCEPTION 'Insufficient promo balance (short by %)', v_remaining; END IF;
  UPDATE public.promo_redemptions SET grant_breakdown = v_breakdown WHERE id = v_red_id;
  RETURN jsonb_build_object('redemption_id', v_red_id, 'amount', p_amount, 'breakdown', v_breakdown);
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_promo_fifo(uuid,uuid,bigint,uuid,uuid,uuid,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.am_issue_grant(
  p_player_id uuid,
  p_casino_id uuid,
  p_amount bigint,
  p_source promo_grant_source,
  p_funding_pool promo_funding_source,
  p_lifetime_mode promo_grant_lifetime_mode DEFAULT 'lifetime',
  p_lifetime_days integer DEFAULT NULL,
  p_fixed_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.get_current_business_date(p_casino_id);
  v_expires date;
  v_grant_id uuid;
  v_balance bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  v_expires := CASE p_lifetime_mode
    WHEN 'lifetime' THEN NULL
    WHEN 'days_after_redeem' THEN v_today + COALESCE(p_lifetime_days, 30)
    WHEN 'fixed_business_date' THEN p_fixed_date
  END;

  IF p_funding_pool = 'am_budget' THEN
    SELECT balance INTO v_balance FROM public.am_budgets WHERE am_user_id = v_uid AND casino_id = p_casino_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'No AM budget allocated for this casino'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient AM budget (have %, need %)', v_balance, p_amount; END IF;
    UPDATE public.am_budgets SET balance = balance - p_amount, updated_at = now() WHERE am_user_id = v_uid AND casino_id = p_casino_id;
  ELSIF p_funding_pool = 'house' THEN
    SELECT balance INTO v_balance FROM public.house_promo_fund WHERE casino_id = p_casino_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient house promo fund'; END IF;
    UPDATE public.house_promo_fund SET balance = balance - p_amount, updated_at = now() WHERE casino_id = p_casino_id;
  ELSE
    RAISE EXCEPTION 'Funding pool % not supported via am_issue_grant', p_funding_pool;
  END IF;

  INSERT INTO public.promo_grants(player_id, casino_id, amount, remaining, source, funding_pool, issued_business_date, expires_business_date, status, created_by)
  VALUES (p_player_id, p_casino_id, p_amount, p_amount, p_source, p_funding_pool, v_today, v_expires, 'active', v_uid)
  RETURNING id INTO v_grant_id;

  INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
  VALUES (v_grant_id, p_player_id, p_amount, COALESCE(p_notes, p_source::text), 'grant_issued', v_grant_id, v_today, v_uid);

  IF p_funding_pool = 'am_budget' THEN
    INSERT INTO public.am_budget_ledger(am_user_id, casino_id, delta, reason, ref_type, ref_id, created_by)
    VALUES (v_uid, p_casino_id, -p_amount, COALESCE(p_notes, 'issue_grant'), 'promo_grant', v_grant_id, v_uid);
  ELSE
    INSERT INTO public.house_promo_ledger(casino_id, delta, reason, ref_type, ref_id, created_by)
    VALUES (p_casino_id, -p_amount, COALESCE(p_notes, 'issue_grant'), 'promo_grant', v_grant_id, v_uid);
  END IF;

  RETURN jsonb_build_object('grant_id', v_grant_id, 'expires', v_expires);
END;
$$;
GRANT EXECUTE ON FUNCTION public.am_issue_grant(uuid,uuid,bigint,promo_grant_source,promo_funding_source,promo_grant_lifetime_mode,integer,date,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.kyc_decide(
  p_review_id uuid,
  p_approve boolean,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rev record;
  v_grant record;
BEGIN
  SELECT * INTO v_rev FROM public.kyc_reviews WHERE id = p_review_id FOR UPDATE;
  IF v_rev IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  IF v_rev.status <> 'pending' THEN RAISE EXCEPTION 'Review already decided'; END IF;

  UPDATE public.kyc_reviews
     SET status = CASE WHEN p_approve THEN 'approved'::kyc_review_status ELSE 'rejected'::kyc_review_status END,
         am_user_id = v_uid, am_decision_at = now(), am_notes = p_notes, updated_at = now()
   WHERE id = p_review_id;

  IF NOT p_approve THEN
    FOR v_grant IN
      SELECT id, remaining FROM public.promo_grants
       WHERE player_id = v_rev.player_id AND source = 'verification_bonus' AND status = 'active'
       FOR UPDATE
    LOOP
      UPDATE public.promo_grants SET status='reversed', remaining=0, updated_at=now() WHERE id=v_grant.id;
      INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
      VALUES (v_grant.id, v_rev.player_id, -v_grant.remaining, 'kyc_reject_reversal', 'kyc_review', p_review_id, public.get_current_business_date(v_rev.casino_id), v_uid);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;
GRANT EXECUTE ON FUNCTION public.kyc_decide(uuid,boolean,text) TO authenticated;
