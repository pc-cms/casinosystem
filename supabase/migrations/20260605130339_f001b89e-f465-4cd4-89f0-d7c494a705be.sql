
-- Per-casino verification bonus configuration
ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS verification_bonus_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_bonus_funding_pool text NOT NULL DEFAULT 'house',
  ADD COLUMN IF NOT EXISTS verification_bonus_lifetime_days integer NOT NULL DEFAULT 30;

-- kyc_decide: auto-issue verification bonus on approve
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
  v_cfg record;
  v_today date;
  v_expires date;
  v_grant_id uuid;
  v_balance bigint;
  v_pool text;
  v_amount bigint;
  v_days integer;
BEGIN
  SELECT * INTO v_rev FROM public.kyc_reviews WHERE id = p_review_id FOR UPDATE;
  IF v_rev IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  IF v_rev.status <> 'pending' THEN RAISE EXCEPTION 'Review already decided'; END IF;

  UPDATE public.kyc_reviews
     SET status = CASE WHEN p_approve THEN 'approved'::kyc_review_status ELSE 'rejected'::kyc_review_status END,
         am_user_id = v_uid, am_decision_at = now(), am_notes = p_notes, updated_at = now()
   WHERE id = p_review_id;

  IF p_approve THEN
    -- Auto-issue verification bonus if configured for this casino
    SELECT verification_bonus_amount, verification_bonus_funding_pool, verification_bonus_lifetime_days
      INTO v_cfg
      FROM public.casinos WHERE id = v_rev.casino_id;

    v_amount := COALESCE(v_cfg.verification_bonus_amount, 0);
    v_pool   := COALESCE(v_cfg.verification_bonus_funding_pool, 'house');
    v_days   := COALESCE(v_cfg.verification_bonus_lifetime_days, 30);

    IF v_amount > 0 THEN
      v_today := public.get_current_business_date(v_rev.casino_id);
      v_expires := CASE WHEN v_days > 0 THEN v_today + v_days ELSE NULL END;

      IF v_pool = 'house' THEN
        SELECT balance INTO v_balance FROM public.house_promo_fund WHERE casino_id = v_rev.casino_id FOR UPDATE;
        IF v_balance IS NULL OR v_balance < v_amount THEN
          RAISE EXCEPTION 'Insufficient house promo fund for verification bonus (have %, need %)', COALESCE(v_balance,0), v_amount;
        END IF;
        UPDATE public.house_promo_fund SET balance = balance - v_amount, updated_at = now() WHERE casino_id = v_rev.casino_id;
      ELSE
        RAISE EXCEPTION 'Verification bonus funding pool % not supported', v_pool;
      END IF;

      INSERT INTO public.promo_grants(player_id, casino_id, amount, remaining, source, funding_pool, issued_business_date, expires_business_date, status, created_by)
      VALUES (v_rev.player_id, v_rev.casino_id, v_amount, v_amount, 'verification_bonus', v_pool::promo_funding_source, v_today, v_expires, 'active', v_uid)
      RETURNING id INTO v_grant_id;

      INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
      VALUES (v_grant_id, v_rev.player_id, v_amount, 'verification_bonus', 'kyc_review', p_review_id, v_today, v_uid);

      INSERT INTO public.house_promo_ledger(casino_id, delta, reason, ref_type, ref_id, created_by)
      VALUES (v_rev.casino_id, -v_amount, 'verification_bonus', 'promo_grant', v_grant_id, v_uid);
    END IF;
  ELSE
    -- On reject: reverse any prior verification bonuses
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
