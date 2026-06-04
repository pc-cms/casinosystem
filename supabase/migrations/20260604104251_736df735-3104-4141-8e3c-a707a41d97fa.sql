
-- FM: Top up AM budget
CREATE OR REPLACE FUNCTION public.fm_topup_am_budget(
  p_am_user_id uuid,
  p_casino_id uuid,
  p_amount bigint,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ledger_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_actor, 'finance_manager') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: finance_manager or super_admin required';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;

  INSERT INTO public.am_budgets(am_user_id, casino_id, balance)
  VALUES (p_am_user_id, p_casino_id, p_amount)
  ON CONFLICT (am_user_id, casino_id) DO UPDATE
    SET balance = public.am_budgets.balance + EXCLUDED.balance,
        updated_at = now();

  INSERT INTO public.am_budget_ledger(am_user_id, casino_id, delta, reason, ref_type, created_by)
  VALUES (p_am_user_id, p_casino_id, p_amount, 'top_up', COALESCE(p_note, 'fm_topup'), v_actor)
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.activity_logs(actor_id, casino_id, action, entity_type, entity_id, metadata)
  VALUES (v_actor, p_casino_id, 'fm_topup_am_budget', 'am_budget',
          p_am_user_id, jsonb_build_object('amount', p_amount, 'note', p_note));

  RETURN v_ledger_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fm_topup_am_budget(uuid,uuid,bigint,text) TO authenticated;

-- FM: Top up house promo fund (per casino)
CREATE OR REPLACE FUNCTION public.fm_topup_house_promo_fund(
  p_casino_id uuid,
  p_amount bigint,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ledger_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_actor, 'finance_manager') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: finance_manager or super_admin required';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;

  INSERT INTO public.house_promo_fund(casino_id, balance)
  VALUES (p_casino_id, p_amount)
  ON CONFLICT (casino_id) DO UPDATE
    SET balance = public.house_promo_fund.balance + EXCLUDED.balance,
        updated_at = now();

  INSERT INTO public.house_promo_ledger(casino_id, delta, reason, ref_type, created_by)
  VALUES (p_casino_id, p_amount, 'top_up', COALESCE(p_note, 'fm_topup'), v_actor)
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.activity_logs(actor_id, casino_id, action, entity_type, entity_id, metadata)
  VALUES (v_actor, p_casino_id, 'fm_topup_house_fund', 'house_promo_fund',
          p_casino_id, jsonb_build_object('amount', p_amount, 'note', p_note));

  RETURN v_ledger_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fm_topup_house_promo_fund(uuid,bigint,text) TO authenticated;

-- FM: Top up campaign total cap
CREATE OR REPLACE FUNCTION public.fm_topup_campaign_budget(
  p_campaign_id uuid,
  p_amount bigint,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_casino_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_actor, 'finance_manager') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: finance_manager or super_admin required';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;

  UPDATE public.premier_promo_campaigns
     SET total_cap = COALESCE(total_cap, 0) + p_amount,
         updated_at = now()
   WHERE id = p_campaign_id
   RETURNING casino_id INTO v_casino_id;

  IF v_casino_id IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  INSERT INTO public.activity_logs(actor_id, casino_id, action, entity_type, entity_id, metadata)
  VALUES (v_actor, v_casino_id, 'fm_topup_campaign', 'premier_promo_campaign',
          p_campaign_id, jsonb_build_object('amount', p_amount, 'note', p_note));

  RETURN p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fm_topup_campaign_budget(uuid,bigint,text) TO authenticated;

-- Ensure am_budgets uniqueness for ON CONFLICT path
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'am_budgets_user_casino_uniq'
  ) THEN
    BEGIN
      ALTER TABLE public.am_budgets
        ADD CONSTRAINT am_budgets_user_casino_uniq UNIQUE (am_user_id, casino_id);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN NULL;
    END;
  END IF;
END $$;

-- Token-based cashier redemption (used by QR scan in cage)
CREATE OR REPLACE FUNCTION public.cashier_redeem_promo_by_account(
  p_club_account_id uuid,
  p_casino_id uuid,
  p_cage_id uuid,
  p_shift_id uuid,
  p_amount bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_player_id uuid;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_actor, 'cashier') OR public.has_role(v_actor, 'manager') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: cashier or manager required';
  END IF;

  SELECT player_id INTO v_player_id
    FROM public.club_accounts
   WHERE id = p_club_account_id;

  IF v_player_id IS NULL THEN RAISE EXCEPTION 'club_account_not_found'; END IF;

  v_result := public.redeem_promo_fifo(v_player_id, p_casino_id, p_cage_id, p_shift_id, p_amount, 'chips');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cashier_redeem_promo_by_account(uuid,uuid,uuid,uuid,bigint) TO authenticated;
