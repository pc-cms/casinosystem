
CREATE OR REPLACE FUNCTION public.club_place_shop_order(
  p_player_id uuid,
  p_item_id uuid,
  p_qty integer,
  p_casino_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_total bigint;
  v_remaining bigint;
  v_order_id uuid;
  v_red_id uuid;
  v_grant RECORD;
  v_take bigint;
  v_breakdown jsonb := '[]'::jsonb;
  v_today date := public.get_current_business_date(p_casino_id);
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  SELECT id, price_credits, stock_qty, is_active INTO v_item
  FROM public.shop_items WHERE id = p_item_id FOR UPDATE;
  IF v_item IS NULL OR NOT v_item.is_active THEN RAISE EXCEPTION 'item_unavailable'; END IF;
  IF v_item.stock_qty < p_qty THEN RAISE EXCEPTION 'out_of_stock (have %, need %)', v_item.stock_qty, p_qty; END IF;

  v_total := v_item.price_credits * p_qty;

  -- Check balance across active grants
  SELECT COALESCE(SUM(remaining), 0) INTO v_remaining
  FROM public.promo_grants
  WHERE player_id = p_player_id AND status = 'active' AND remaining > 0;
  IF v_remaining < v_total THEN
    RAISE EXCEPTION 'insufficient_balance (have %, need %)', v_remaining, v_total;
  END IF;

  -- Decrement stock
  UPDATE public.shop_items SET stock_qty = stock_qty - p_qty, updated_at = now() WHERE id = p_item_id;
  INSERT INTO public.shop_stock_movements(shop_item_id, delta, reason, created_by)
    VALUES (p_item_id, -p_qty, 'order_reserve', NULL);

  -- Create order
  INSERT INTO public.shop_orders(casino_id, player_id, shop_item_id, qty, unit_price_credits, total_credits, status)
    VALUES (p_casino_id, p_player_id, p_item_id, p_qty, v_item.price_credits, v_total, 'queued')
    RETURNING id INTO v_order_id;

  -- Create redemption record
  INSERT INTO public.promo_redemptions(player_id, casino_id, cage_id, cashier_id, shift_id, amount, breakdown, payout_type)
    VALUES (p_player_id, p_casino_id, NULL, NULL, NULL, v_total, '[]'::jsonb, 'shop')
    RETURNING id INTO v_red_id;

  -- FIFO debit
  DECLARE v_left bigint := v_total;
  BEGIN
    FOR v_grant IN
      SELECT id, remaining FROM public.promo_grants
      WHERE player_id = p_player_id AND status = 'active' AND remaining > 0
      ORDER BY COALESCE(expires_at, 'infinity'::timestamptz) ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(v_grant.remaining, v_left);
      UPDATE public.promo_grants
        SET remaining = remaining - v_take,
            status = CASE WHEN remaining - v_take = 0 THEN 'depleted' ELSE 'active' END,
            updated_at = now()
        WHERE id = v_grant.id;
      INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, kind, ref_type, ref_id, business_date, created_by)
        VALUES (v_grant.id, p_player_id, -v_take, 'redeem', 'shop_order', v_order_id, v_today, NULL);
      v_breakdown := v_breakdown || jsonb_build_object('grant_id', v_grant.id, 'used', v_take);
      v_left := v_left - v_take;
    END LOOP;
  END;

  UPDATE public.promo_redemptions SET breakdown = v_breakdown WHERE id = v_red_id;

  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total, 'breakdown', v_breakdown);
END $$;

GRANT EXECUTE ON FUNCTION public.club_place_shop_order(uuid, uuid, integer, uuid) TO service_role;
