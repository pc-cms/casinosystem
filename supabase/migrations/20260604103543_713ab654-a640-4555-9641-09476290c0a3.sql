
-- 1. Club FIFO lottery purchase (debits promo wallet)
CREATE OR REPLACE FUNCTION public.club_buy_lottery_ticket(
  p_player_id uuid,
  p_lottery_id uuid,
  p_qty integer,
  p_casino_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot RECORD;
  v_total bigint;
  v_today date;
  v_cap bigint;
  v_spent_today bigint;
  v_sold_total integer;
  v_player_owned integer;
  v_balance bigint;
  v_grant RECORD;
  v_left bigint;
  v_take bigint;
  v_breakdown jsonb := '[]'::jsonb;
  v_next_num integer;
  v_tickets jsonb := '[]'::jsonb;
  i integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  SELECT * INTO v_lot FROM public.lotteries WHERE id = p_lottery_id FOR UPDATE;
  IF v_lot IS NULL THEN RAISE EXCEPTION 'lottery_not_found'; END IF;
  IF v_lot.status <> 'open' THEN RAISE EXCEPTION 'lottery_closed'; END IF;
  IF v_lot.casino_id <> p_casino_id THEN RAISE EXCEPTION 'casino_mismatch'; END IF;

  v_today := public.get_current_business_date(p_casino_id);
  IF v_lot.draw_business_date < v_today THEN RAISE EXCEPTION 'lottery_draw_passed'; END IF;

  v_total := v_lot.ticket_price_credits * p_qty;

  -- Per-player cap
  IF v_lot.max_tickets_per_player IS NOT NULL THEN
    SELECT COUNT(*) INTO v_player_owned FROM public.lottery_tickets
     WHERE lottery_id = p_lottery_id AND player_id = p_player_id;
    IF v_player_owned + p_qty > v_lot.max_tickets_per_player THEN
      RAISE EXCEPTION 'per_player_limit_exceeded (have %, cap %)', v_player_owned, v_lot.max_tickets_per_player;
    END IF;
  END IF;

  -- Total tickets cap
  IF v_lot.total_tickets_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_sold_total FROM public.lottery_tickets WHERE lottery_id = p_lottery_id;
    IF v_sold_total + p_qty > v_lot.total_tickets_cap THEN
      RAISE EXCEPTION 'lottery_sold_out (have %, cap %)', v_sold_total, v_lot.total_tickets_cap;
    END IF;
  END IF;

  -- Daily promo spend cap (counts only club_pwa, by virtue of going through promo wallet)
  SELECT daily_cap_credits INTO v_cap
    FROM public.club_daily_spend_limits
    WHERE casino_id = p_casino_id AND effective_from <= v_today
    ORDER BY effective_from DESC LIMIT 1;
  IF v_cap IS NOT NULL THEN
    SELECT COALESCE(SUM(amount),0) INTO v_spent_today
      FROM public.promo_redemptions
      WHERE casino_id = p_casino_id AND created_at::date = v_today;
    IF v_spent_today + v_total > v_cap THEN
      RAISE EXCEPTION 'daily_promo_cap_exceeded (%/%)', v_spent_today + v_total, v_cap;
    END IF;
  END IF;

  -- Balance check
  SELECT COALESCE(SUM(remaining),0) INTO v_balance
    FROM public.promo_grants
    WHERE player_id = p_player_id AND status = 'active' AND remaining > 0
      AND (expires_business_date IS NULL OR expires_business_date >= v_today);
  IF v_balance < v_total THEN
    RAISE EXCEPTION 'insufficient_balance (have %, need %)', v_balance, v_total;
  END IF;

  -- Single redemption row for the whole purchase
  DECLARE v_red_id uuid;
  BEGIN
    INSERT INTO public.promo_redemptions(player_id, casino_id, cage_id, cashier_id, shift_id, amount, grant_breakdown, payout_type)
      VALUES (p_player_id, p_casino_id, NULL, NULL, NULL, v_total, '[]'::jsonb, 'lottery')
      RETURNING id INTO v_red_id;

    v_left := v_total;
    FOR v_grant IN
      SELECT id, remaining, expires_business_date FROM public.promo_grants
       WHERE player_id = p_player_id AND status = 'active' AND remaining > 0
         AND (expires_business_date IS NULL OR expires_business_date >= v_today)
       ORDER BY (expires_business_date IS NULL), expires_business_date ASC, created_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(v_grant.remaining, v_left);
      UPDATE public.promo_grants
         SET remaining = remaining - v_take,
             status = CASE WHEN remaining - v_take = 0 THEN 'exhausted'::promo_grant_status ELSE status END,
             updated_at = now()
       WHERE id = v_grant.id;
      INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
      VALUES (v_grant.id, p_player_id, -v_take, 'lottery_purchase', 'lottery', p_lottery_id, v_today, NULL);
      v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object('grant_id', v_grant.id, 'amount', v_take));
      v_left := v_left - v_take;
    END LOOP;

    UPDATE public.promo_redemptions SET grant_breakdown = v_breakdown WHERE id = v_red_id;
  END;

  -- Issue ticket rows
  SELECT COALESCE(MAX(ticket_number),0) INTO v_next_num FROM public.lottery_tickets WHERE lottery_id = p_lottery_id;
  FOR i IN 1..p_qty LOOP
    v_next_num := v_next_num + 1;
    INSERT INTO public.lottery_tickets(lottery_id, player_id, ticket_number, paid_credits, purchased_via)
      VALUES (p_lottery_id, p_player_id, v_next_num, v_lot.ticket_price_credits, 'club_pwa');
    v_tickets := v_tickets || jsonb_build_array(v_next_num);
  END LOOP;

  RETURN jsonb_build_object('lottery_id', p_lottery_id, 'qty', p_qty, 'total', v_total, 'tickets', v_tickets, 'breakdown', v_breakdown);
END $$;

GRANT EXECUTE ON FUNCTION public.club_buy_lottery_ticket(uuid, uuid, integer, uuid) TO service_role, authenticated;


-- 2. Cashier issues lottery tickets for cash
CREATE OR REPLACE FUNCTION public.cashier_issue_lottery_ticket(
  p_player_id uuid,
  p_lottery_id uuid,
  p_qty integer,
  p_casino_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot RECORD;
  v_today date;
  v_player_owned integer;
  v_sold_total integer;
  v_next_num integer;
  v_tickets jsonb := '[]'::jsonb;
  v_total bigint;
  v_uid uuid := auth.uid();
  i integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  SELECT * INTO v_lot FROM public.lotteries WHERE id = p_lottery_id FOR UPDATE;
  IF v_lot IS NULL THEN RAISE EXCEPTION 'lottery_not_found'; END IF;
  IF v_lot.status <> 'open' THEN RAISE EXCEPTION 'lottery_closed'; END IF;
  IF v_lot.casino_id <> p_casino_id THEN RAISE EXCEPTION 'casino_mismatch'; END IF;

  v_today := public.get_current_business_date(p_casino_id);
  IF v_lot.draw_business_date < v_today THEN RAISE EXCEPTION 'lottery_draw_passed'; END IF;

  IF v_lot.max_tickets_per_player IS NOT NULL THEN
    SELECT COUNT(*) INTO v_player_owned FROM public.lottery_tickets
     WHERE lottery_id = p_lottery_id AND player_id = p_player_id;
    IF v_player_owned + p_qty > v_lot.max_tickets_per_player THEN
      RAISE EXCEPTION 'per_player_limit_exceeded (have %, cap %)', v_player_owned, v_lot.max_tickets_per_player;
    END IF;
  END IF;

  IF v_lot.total_tickets_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_sold_total FROM public.lottery_tickets WHERE lottery_id = p_lottery_id;
    IF v_sold_total + p_qty > v_lot.total_tickets_cap THEN
      RAISE EXCEPTION 'lottery_sold_out (have %, cap %)', v_sold_total, v_lot.total_tickets_cap;
    END IF;
  END IF;

  v_total := v_lot.ticket_price_credits * p_qty;

  SELECT COALESCE(MAX(ticket_number),0) INTO v_next_num FROM public.lottery_tickets WHERE lottery_id = p_lottery_id;
  FOR i IN 1..p_qty LOOP
    v_next_num := v_next_num + 1;
    INSERT INTO public.lottery_tickets(lottery_id, player_id, ticket_number, paid_credits, purchased_via)
      VALUES (p_lottery_id, p_player_id, v_next_num, v_lot.ticket_price_credits, 'am_manual');
    v_tickets := v_tickets || jsonb_build_array(v_next_num);
  END LOOP;

  -- Audit (best effort; activity_logs schema flexible)
  BEGIN
    INSERT INTO public.activity_logs(user_id, casino_id, action, entity_type, entity_id, details)
    VALUES (v_uid, p_casino_id, 'lottery_ticket_issue_cash', 'lottery', p_lottery_id,
            jsonb_build_object('player_id', p_player_id, 'qty', p_qty, 'total_cash', v_total, 'tickets', v_tickets));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('lottery_id', p_lottery_id, 'qty', p_qty, 'total_cash', v_total, 'tickets', v_tickets);
END $$;

GRANT EXECUTE ON FUNCTION public.cashier_issue_lottery_ticket(uuid, uuid, integer, uuid) TO authenticated;


-- Allow lottery_tickets inserts for cashiers and the SECURITY DEFINER context
DROP POLICY IF EXISTS "lt_insert" ON public.lottery_tickets;
CREATE POLICY "lt_insert" ON public.lottery_tickets FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'cashier'::app_role)
  );
