-- ============================================================
-- 1) Seed 10 demo shop items (shared catalog, casino_id NULL)
-- ============================================================
INSERT INTO public.shop_items (sku, name, description, price_credits, stock_qty, photo_url, is_active)
VALUES
  ('DEMO-LC300',  'Toyota Land Cruiser 300',
    'Brand-new Land Cruiser 300 VX, full options. Delivered with full registration, insurance for 12 months and a champagne reception at the cage.',
    320000000, 1,
    'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-IPH17',  'iPhone 17 Pro Max 1 TB',
    'Titanium frame, 1 TB storage, AppleCare+ included. Sealed box, factory unlocked, ready to use anywhere in the world.',
    4800000, 6,
    'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-TV75',   'Samsung Neo QLED 8K 75"',
    'Flagship 8K Neo QLED TV with Quantum Mini-LED backlight, AI upscaling and Dolby Atmos sound. Wall mount and 5-year warranty included.',
    6500000, 3,
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-HENXO', 'Hennessy X.O 1.5 L',
    'Premium cognac, 1.5 L magnum. Aged eaux-de-vie blend in the iconic decanter, presented in a signature gift box.',
    850000, 12,
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-ROLEX', 'Rolex Submariner Date',
    'Stainless steel Submariner Date, black dial, 41 mm. Full set with box, papers and 5-year international warranty.',
    48000000, 1,
    'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-MBP16', 'MacBook Pro 16" M5 Max',
    'M5 Max chip, 64 GB unified memory, 2 TB SSD. Liquid Retina XDR display, AppleCare+ for 3 years included.',
    9200000, 4,
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-PS5',   'PlayStation 5 Pro Bundle',
    'PS5 Pro console with 2 TB SSD, two DualSense controllers and three premium titles. Plug, play and start the night right.',
    2100000, 8,
    'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-LVBAG', 'Louis Vuitton Keepall 55',
    'Iconic monogram canvas travel bag, hand-stitched in France. Includes name tag, padlock and dust cover.',
    5700000, 2,
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-SAFARI','Serengeti Safari Weekend for 2',
    'Two-night all-inclusive stay at a luxury Serengeti lodge. Private game drives, gourmet bush dining and return charter flights from Arusha.',
    3900000, 5,
    'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80', true),
  ('DEMO-ESPRESSO','La Marzocco Linea Mini',
    'Hand-built Italian espresso machine for the home barista. Includes a precision grinder, tamper set and 1 kg of premium roast.',
    1450000, 4,
    'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=1200&q=80', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) Player-facing promo code redemption RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.club_redeem_promo_code(
  p_player_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code           public.promo_codes%ROWTYPE;
  v_normalized     text := upper(regexp_replace(coalesce(p_code,''), '\s+', '', 'g'));
  v_casino_id      uuid;
  v_today          date;
  v_uses_by_player int;
  v_expires        date;
  v_grant_id       uuid;
  v_fund_balance   bigint;
BEGIN
  IF p_player_id IS NULL THEN RAISE EXCEPTION 'player_id_required'; END IF;
  IF v_normalized = '' THEN RAISE EXCEPTION 'code_required'; END IF;

  SELECT casino_id INTO v_casino_id FROM public.players WHERE id = p_player_id;
  IF v_casino_id IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;

  -- Lock the code row for the duration of the redemption
  SELECT * INTO v_code FROM public.promo_codes WHERE code = v_normalized FOR UPDATE;
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;

  IF v_code.code_active_from IS NOT NULL AND now() < v_code.code_active_from THEN
    RAISE EXCEPTION 'code_not_started';
  END IF;
  IF v_code.code_active_until IS NOT NULL AND now() > v_code.code_active_until THEN
    RAISE EXCEPTION 'code_expired';
  END IF;
  IF v_code.max_uses_total IS NOT NULL AND v_code.current_uses >= v_code.max_uses_total THEN
    RAISE EXCEPTION 'code_exhausted';
  END IF;

  SELECT count(*) INTO v_uses_by_player
  FROM public.promo_code_redemptions
  WHERE code_id = v_code.id AND player_id = p_player_id;
  IF v_uses_by_player >= v_code.per_player_limit THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  v_today := public.get_current_business_date(v_casino_id);
  v_expires := CASE v_code.grant_lifetime_mode
    WHEN 'lifetime'             THEN NULL
    WHEN 'days_after_redeem'    THEN v_today + COALESCE(v_code.grant_lifetime_days, 30)
    WHEN 'fixed_business_date'  THEN v_code.grant_fixed_business_date
  END;

  -- Debit the house promo fund of the player's home casino
  SELECT balance INTO v_fund_balance FROM public.house_promo_fund WHERE casino_id = v_casino_id FOR UPDATE;
  IF v_fund_balance IS NULL OR v_fund_balance < v_code.amount THEN
    RAISE EXCEPTION 'house_fund_insufficient';
  END IF;
  UPDATE public.house_promo_fund SET balance = balance - v_code.amount, updated_at = now()
   WHERE casino_id = v_casino_id;

  INSERT INTO public.promo_grants(
    player_id, casino_id, amount, remaining, source, funding_pool,
    issued_business_date, expires_business_date, status
  )
  VALUES (
    p_player_id, v_casino_id, v_code.amount, v_code.amount, 'promo_code', 'house',
    v_today, v_expires, 'active'
  )
  RETURNING id INTO v_grant_id;

  INSERT INTO public.promo_wallet_ledger(
    grant_id, player_id, delta, reason, ref_type, ref_id, business_date
  )
  VALUES (
    v_grant_id, p_player_id, v_code.amount, 'promo_code:' || v_code.code, 'grant_issued', v_grant_id, v_today
  );

  INSERT INTO public.house_promo_ledger(casino_id, delta, reason, ref_type, ref_id)
  VALUES (v_casino_id, -v_code.amount, 'club_redeem_code:' || v_code.code, 'promo_grant', v_grant_id);

  INSERT INTO public.promo_code_redemptions(code_id, player_id, grant_id, business_date)
  VALUES (v_code.id, p_player_id, v_grant_id, v_today);

  UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'grant_id', v_grant_id,
    'amount',   v_code.amount,
    'expires',  v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.club_redeem_promo_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_redeem_promo_code(uuid, text) TO service_role;
