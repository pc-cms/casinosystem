
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS code_kind text NOT NULL DEFAULT 'batch' CHECK (code_kind IN ('single','batch')),
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS batch_label text,
  ADD COLUMN IF NOT EXISTS assigned_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_by_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_promo_code_format()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RAISE EXCEPTION 'Promo code must be 8 chars from A-Z/2-9 (no 0,O,1,I): %', NEW.code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_promo_codes_format ON public.promo_codes;
CREATE TRIGGER trg_promo_codes_format
  BEFORE INSERT OR UPDATE OF code ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.validate_promo_code_format();

CREATE INDEX IF NOT EXISTS idx_promo_codes_batch ON public.promo_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_campaign ON public.promo_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_assigned ON public.promo_codes(assigned_player_id) WHERE assigned_player_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_one_code_per_campaign_player()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_campaign uuid;
BEGIN
  SELECT campaign_id INTO v_campaign FROM public.promo_codes WHERE id = NEW.code_id;
  IF v_campaign IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.promo_code_redemptions r
    JOIN public.promo_codes c ON c.id = r.code_id
    WHERE r.player_id = NEW.player_id AND c.campaign_id = v_campaign
      AND r.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Player % already redeemed a code from campaign %', NEW.player_id, v_campaign;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_one_code_per_campaign ON public.promo_code_redemptions;
CREATE TRIGGER trg_one_code_per_campaign
  BEFORE INSERT ON public.promo_code_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_code_per_campaign_player();

CREATE TABLE IF NOT EXISTS public.club_daily_spend_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  daily_cap_credits bigint NOT NULL DEFAULT 500000,
  effective_from date NOT NULL DEFAULT current_date,
  set_by uuid REFERENCES auth.users(id),
  set_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(casino_id, effective_from)
);
GRANT SELECT, INSERT, UPDATE ON public.club_daily_spend_limits TO authenticated;
GRANT ALL ON public.club_daily_spend_limits TO service_role;
ALTER TABLE public.club_daily_spend_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdsl_read" ON public.club_daily_spend_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "cdsl_write" ON public.club_daily_spend_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.lotteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  draw_business_date date NOT NULL,
  ticket_price_credits bigint NOT NULL CHECK (ticket_price_credits > 0),
  max_tickets_per_player integer,
  total_tickets_cap integer,
  prize_fund_description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.lotteries TO authenticated;
GRANT ALL ON public.lotteries TO service_role;
ALTER TABLE public.lotteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lotteries_read" ON public.lotteries FOR SELECT TO authenticated USING (true);
CREATE POLICY "lotteries_write" ON public.lotteries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.lottery_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  ticket_number integer NOT NULL,
  paid_credits bigint NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  purchased_via text NOT NULL DEFAULT 'club_pwa' CHECK (purchased_via IN ('club_pwa','am_manual')),
  UNIQUE(lottery_id, ticket_number)
);
GRANT SELECT, INSERT ON public.lottery_tickets TO authenticated;
GRANT ALL ON public.lottery_tickets TO service_role;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt_read" ON public.lottery_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "lt_insert" ON public.lottery_tickets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_lt_player ON public.lottery_tickets(player_id);
CREATE INDEX IF NOT EXISTS idx_lt_lottery ON public.lottery_tickets(lottery_id);

CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES public.casinos(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  description text,
  price_credits bigint NOT NULL CHECK (price_credits > 0),
  stock_qty integer NOT NULL DEFAULT 0,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_items_read" ON public.shop_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop_items_write" ON public.shop_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  shop_item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE RESTRICT,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price_credits bigint NOT NULL,
  total_credits bigint NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','issued','cancelled')),
  ordered_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid REFERENCES auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id),
  cancel_reason text,
  notes text
);
GRANT SELECT, INSERT, UPDATE ON public.shop_orders TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_orders_read" ON public.shop_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop_orders_write" ON public.shop_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_shop_orders_player ON public.shop_orders(player_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);

CREATE TABLE IF NOT EXISTS public.shop_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('restock','adjust','order_reserve','order_cancel','manual')),
  ref_order_id uuid REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT, INSERT ON public.shop_stock_movements TO authenticated;
GRANT ALL ON public.shop_stock_movements TO service_role;
ALTER TABLE public.shop_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssm_read" ON public.shop_stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_no_update" ON public.shop_stock_movements FOR UPDATE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.shop_order_reserve_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_stock integer;
BEGIN
  IF NEW.status = 'queued' THEN
    SELECT stock_qty INTO v_stock FROM public.shop_items WHERE id = NEW.shop_item_id FOR UPDATE;
    IF v_stock < NEW.qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %: have %, need %', NEW.shop_item_id, v_stock, NEW.qty;
    END IF;
    UPDATE public.shop_items SET stock_qty = stock_qty - NEW.qty, updated_at = now() WHERE id = NEW.shop_item_id;
    INSERT INTO public.shop_stock_movements(shop_item_id, delta, reason, ref_order_id, created_by)
      VALUES (NEW.shop_item_id, -NEW.qty, 'order_reserve', NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_reserve ON public.shop_orders;
CREATE TRIGGER trg_shop_order_reserve
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.shop_order_reserve_stock();

CREATE OR REPLACE FUNCTION public.shop_order_cancel_restock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'queued' AND NEW.status = 'cancelled' THEN
    UPDATE public.shop_items SET stock_qty = stock_qty + OLD.qty, updated_at = now() WHERE id = OLD.shop_item_id;
    INSERT INTO public.shop_stock_movements(shop_item_id, delta, reason, ref_order_id, created_by)
      VALUES (OLD.shop_item_id, OLD.qty, 'order_cancel', OLD.id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_cancel ON public.shop_orders;
CREATE TRIGGER trg_shop_order_cancel
  AFTER UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.shop_order_cancel_restock();
