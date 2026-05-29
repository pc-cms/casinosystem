
-- ============================================================
-- POS Module — M0.2 Tables, RLS, Triggers, Grants
-- ============================================================

-- Helper: any POS role
CREATE OR REPLACE FUNCTION public.has_any_pos_role(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'pos_waiter'::app_role)
      OR public.has_role(_user, 'pos_bartender'::app_role)
      OR public.has_role(_user, 'pos_manager'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_casino(_user uuid, _casino uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_casino_access
    WHERE user_id = _user AND casino_id = _casino
  ) OR public.has_role(_user, 'super_admin'::app_role)
    OR public.has_role(_user, 'finance_manager'::app_role);
$$;

-- ============================================================
-- pos_menu_categories
-- ============================================================
CREATE TABLE public.pos_menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_menu_categories_casino ON public.pos_menu_categories(casino_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_menu_categories TO authenticated;
GRANT ALL ON public.pos_menu_categories TO service_role;
ALTER TABLE public.pos_menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_menu_categories_select" ON public.pos_menu_categories
  FOR SELECT TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_any_pos_role(auth.uid())
      OR public.has_role(auth.uid(),'manager'::app_role)
      OR public.has_role(auth.uid(),'finance_manager'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
    )
  );

CREATE POLICY "pos_menu_categories_write" ON public.pos_menu_categories
  FOR ALL TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (public.has_role(auth.uid(),'pos_manager'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  )
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (public.has_role(auth.uid(),'pos_manager'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

-- ============================================================
-- pos_menu_items
-- ============================================================
CREATE TABLE public.pos_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.pos_menu_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  price_tzs bigint NOT NULL CHECK (price_tzs >= 0),
  stock_qty numeric,                 -- NULL = inventory not tracked
  low_threshold numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_menu_items_casino ON public.pos_menu_items(casino_id, category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_menu_items TO authenticated;
GRANT ALL ON public.pos_menu_items TO service_role;
ALTER TABLE public.pos_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_menu_items_select" ON public.pos_menu_items
  FOR SELECT TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_any_pos_role(auth.uid())
      OR public.has_role(auth.uid(),'manager'::app_role)
      OR public.has_role(auth.uid(),'finance_manager'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
      OR public.has_role(auth.uid(),'pit'::app_role)  -- Pit needs menu to create comp orders
    )
  );

CREATE POLICY "pos_menu_items_write" ON public.pos_menu_items
  FOR ALL TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (public.has_role(auth.uid(),'pos_manager'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  )
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (public.has_role(auth.uid(),'pos_manager'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

-- ============================================================
-- pos_menu_price_history (immutable)
-- ============================================================
CREATE TABLE public.pos_menu_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.pos_menu_items(id) ON DELETE CASCADE,
  old_price_tzs bigint,
  new_price_tzs bigint NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_price_history_item ON public.pos_menu_price_history(item_id, changed_at DESC);

GRANT SELECT, INSERT ON public.pos_menu_price_history TO authenticated;
GRANT ALL ON public.pos_menu_price_history TO service_role;
ALTER TABLE public.pos_menu_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_price_history_select" ON public.pos_menu_price_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_menu_items mi
      WHERE mi.id = pos_menu_price_history.item_id
        AND public.user_can_see_casino(auth.uid(), mi.casino_id)
        AND (public.has_role(auth.uid(),'pos_manager'::app_role)
             OR public.has_role(auth.uid(),'manager'::app_role)
             OR public.has_role(auth.uid(),'finance_manager'::app_role)
             OR public.has_role(auth.uid(),'super_admin'::app_role))
    )
  );

CREATE OR REPLACE FUNCTION public.pos_menu_price_history_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'pos_menu_price_history is immutable';
END $$;
CREATE TRIGGER trg_pos_price_history_no_update BEFORE UPDATE OR DELETE ON public.pos_menu_price_history
  FOR EACH ROW EXECUTE FUNCTION public.pos_menu_price_history_immutable();

-- Trigger to record price changes
CREATE OR REPLACE FUNCTION public.pos_menu_items_price_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pos_menu_price_history(item_id, old_price_tzs, new_price_tzs, changed_by)
    VALUES (NEW.id, NULL, NEW.price_tzs, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.price_tzs IS DISTINCT FROM OLD.price_tzs THEN
    INSERT INTO public.pos_menu_price_history(item_id, old_price_tzs, new_price_tzs, changed_by)
    VALUES (NEW.id, OLD.price_tzs, NEW.price_tzs, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_menu_items_price_audit
  BEFORE INSERT OR UPDATE ON public.pos_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_menu_items_price_audit();

CREATE OR REPLACE FUNCTION public.pos_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_pos_categories_touch BEFORE UPDATE ON public.pos_menu_categories
  FOR EACH ROW EXECUTE FUNCTION public.pos_touch_updated_at();

-- ============================================================
-- pos_shifts
-- ============================================================
CREATE TABLE public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  waiter_user_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash bigint NOT NULL DEFAULT 0,
  closing_cash bigint,
  z_report jsonb,
  business_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_shifts_casino_waiter ON public.pos_shifts(casino_id, waiter_user_id, opened_at DESC);
CREATE UNIQUE INDEX uq_pos_shift_one_open ON public.pos_shifts(casino_id, waiter_user_id) WHERE closed_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.pos_shifts TO authenticated;
GRANT ALL ON public.pos_shifts TO service_role;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_shifts_select" ON public.pos_shifts
  FOR SELECT TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      waiter_user_id = auth.uid()
      OR public.has_role(auth.uid(),'pos_manager'::app_role)
      OR public.has_role(auth.uid(),'pos_bartender'::app_role)
      OR public.has_role(auth.uid(),'manager'::app_role)
      OR public.has_role(auth.uid(),'finance_manager'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
    )
  );

CREATE POLICY "pos_shifts_insert" ON public.pos_shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    waiter_user_id = auth.uid()
    AND public.user_can_see_casino(auth.uid(), casino_id)
    AND public.has_role(auth.uid(),'pos_waiter'::app_role)
  );

CREATE POLICY "pos_shifts_update_close" ON public.pos_shifts
  FOR UPDATE TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (waiter_user_id = auth.uid()
         OR public.has_role(auth.uid(),'pos_manager'::app_role))
  )
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
  );

-- Set business_date on insert
CREATE OR REPLACE FUNCTION public.pos_shifts_set_business_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.business_date IS NULL THEN
    BEGIN
      NEW.business_date := public.get_current_business_date(NEW.casino_id);
    EXCEPTION WHEN OTHERS THEN
      NEW.business_date := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
    END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_shifts_set_business_date
  BEFORE INSERT ON public.pos_shifts
  FOR EACH ROW EXECUTE FUNCTION public.pos_shifts_set_business_date();

-- ============================================================
-- pos_orders
-- ============================================================
CREATE TABLE public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  shift_id uuid REFERENCES public.pos_shifts(id),
  waiter_user_id uuid NOT NULL,
  player_id uuid,
  player_name text,
  table_id uuid,
  table_label text,
  payment_mode pos_payment_mode NOT NULL,
  total_tzs bigint NOT NULL DEFAULT 0 CHECK (total_tzs >= 0),
  status pos_order_status NOT NULL DEFAULT 'pending',
  comp_reason text,
  expense_id uuid,
  business_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  served_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  source text NOT NULL DEFAULT 'pos'   -- 'pos' | 'pit'
);
CREATE INDEX idx_pos_orders_casino_date ON public.pos_orders(casino_id, business_date DESC, created_at DESC);
CREATE INDEX idx_pos_orders_status ON public.pos_orders(casino_id, status, created_at DESC);
CREATE INDEX idx_pos_orders_shift ON public.pos_orders(shift_id);
CREATE INDEX idx_pos_orders_player ON public.pos_orders(player_id) WHERE player_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.pos_orders TO authenticated;
GRANT ALL ON public.pos_orders TO service_role;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_orders_select" ON public.pos_orders
  FOR SELECT TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_any_pos_role(auth.uid())
      OR public.has_role(auth.uid(),'manager'::app_role)
      OR public.has_role(auth.uid(),'finance_manager'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
      OR public.has_role(auth.uid(),'pit'::app_role)
    )
  );

CREATE POLICY "pos_orders_insert" ON public.pos_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      (public.has_role(auth.uid(),'pos_waiter'::app_role) AND waiter_user_id = auth.uid())
      OR public.has_role(auth.uid(),'pos_manager'::app_role)
      OR (public.has_role(auth.uid(),'pit'::app_role) AND payment_mode = 'comp_player')
    )
  );

-- Update allowed only for status transitions + void (immutable financial fields are guarded by trigger)
CREATE POLICY "pos_orders_update" ON public.pos_orders
  FOR UPDATE TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(),'pos_bartender'::app_role)
      OR public.has_role(auth.uid(),'pos_manager'::app_role)
      OR public.has_role(auth.uid(),'pos_waiter'::app_role)
      OR public.has_role(auth.uid(),'super_admin'::app_role)
    )
  )
  WITH CHECK (public.user_can_see_casino(auth.uid(), casino_id));

-- Immutability of financial fields on pos_orders
CREATE OR REPLACE FUNCTION public.pos_orders_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.total_tzs IS DISTINCT FROM OLD.total_tzs
       OR NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.waiter_user_id IS DISTINCT FROM OLD.waiter_user_id
       OR NEW.business_date IS DISTINCT FROM OLD.business_date
       OR NEW.expense_id IS DISTINCT FROM OLD.expense_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'pos_orders: financial/identity fields are immutable. Use a void+new order.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_orders_guard BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.pos_orders_guard();

CREATE OR REPLACE FUNCTION public.pos_orders_set_business_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.business_date IS NULL THEN
    BEGIN
      NEW.business_date := public.get_current_business_date(NEW.casino_id);
    EXCEPTION WHEN OTHERS THEN
      NEW.business_date := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
    END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_orders_set_business_date
  BEFORE INSERT ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.pos_orders_set_business_date();

-- ============================================================
-- pos_order_items (immutable)
-- ============================================================
CREATE TABLE public.pos_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.pos_menu_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  unit_price_tzs bigint NOT NULL CHECK (unit_price_tzs >= 0),
  line_total_tzs bigint NOT NULL CHECK (line_total_tzs >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_order_items_order ON public.pos_order_items(order_id);

GRANT SELECT, INSERT ON public.pos_order_items TO authenticated;
GRANT ALL ON public.pos_order_items TO service_role;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_order_items_select" ON public.pos_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_orders o
      WHERE o.id = pos_order_items.order_id
        AND public.user_can_see_casino(auth.uid(), o.casino_id)
        AND (
          public.has_any_pos_role(auth.uid())
          OR public.has_role(auth.uid(),'manager'::app_role)
          OR public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)
          OR public.has_role(auth.uid(),'pit'::app_role)
        )
    )
  );

CREATE POLICY "pos_order_items_insert" ON public.pos_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pos_orders o
      WHERE o.id = pos_order_items.order_id
        AND public.user_can_see_casino(auth.uid(), o.casino_id)
    )
  );

CREATE OR REPLACE FUNCTION public.pos_order_items_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'pos_order_items is immutable';
END $$;
CREATE TRIGGER trg_pos_order_items_no_update BEFORE UPDATE OR DELETE ON public.pos_order_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_order_items_immutable();

-- Reduce stock + roll up total on insert
CREATE OR REPLACE FUNCTION public.pos_order_items_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pos_menu_items
     SET stock_qty = stock_qty - NEW.qty,
         updated_at = now()
   WHERE id = NEW.item_id AND stock_qty IS NOT NULL;

  UPDATE public.pos_orders
     SET total_tzs = COALESCE((
       SELECT SUM(line_total_tzs) FROM public.pos_order_items WHERE order_id = NEW.order_id
     ), 0)
   WHERE id = NEW.order_id;

  RETURN NEW;
END $$;
-- We need to bypass pos_orders_guard (which forbids total change) for this internal update;
-- so we mark via a session GUC.
CREATE OR REPLACE FUNCTION public.pos_orders_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_internal text;
BEGIN
  v_internal := current_setting('pos.internal', true);
  IF TG_OP = 'UPDATE' AND COALESCE(v_internal,'') <> 'on' THEN
    IF NEW.total_tzs IS DISTINCT FROM OLD.total_tzs
       OR NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.waiter_user_id IS DISTINCT FROM OLD.waiter_user_id
       OR NEW.business_date IS DISTINCT FROM OLD.business_date
       OR NEW.expense_id IS DISTINCT FROM OLD.expense_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'pos_orders: financial/identity fields are immutable. Use a void+new order.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pos_order_items_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pos_menu_items
     SET stock_qty = stock_qty - NEW.qty,
         updated_at = now()
   WHERE id = NEW.item_id AND stock_qty IS NOT NULL;

  PERFORM set_config('pos.internal','on', true);
  UPDATE public.pos_orders
     SET total_tzs = COALESCE((
       SELECT SUM(line_total_tzs) FROM public.pos_order_items WHERE order_id = NEW.order_id
     ), 0)
   WHERE id = NEW.order_id;
  PERFORM set_config('pos.internal','', true);

  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_order_items_after_insert
  AFTER INSERT ON public.pos_order_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_order_items_after_insert();

-- ============================================================
-- pos_inventory_movements (immutable)
-- ============================================================
CREATE TABLE public.pos_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.pos_menu_items(id) ON DELETE CASCADE,
  delta numeric NOT NULL CHECK (delta <> 0),
  reason text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_inventory_item ON public.pos_inventory_movements(item_id, created_at DESC);

GRANT SELECT, INSERT ON public.pos_inventory_movements TO authenticated;
GRANT ALL ON public.pos_inventory_movements TO service_role;
ALTER TABLE public.pos_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_inv_select" ON public.pos_inventory_movements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_menu_items mi
      WHERE mi.id = pos_inventory_movements.item_id
        AND public.user_can_see_casino(auth.uid(), mi.casino_id)
        AND (public.has_role(auth.uid(),'pos_manager'::app_role)
             OR public.has_role(auth.uid(),'manager'::app_role)
             OR public.has_role(auth.uid(),'finance_manager'::app_role)
             OR public.has_role(auth.uid(),'super_admin'::app_role))
    )
  );

CREATE POLICY "pos_inv_insert" ON public.pos_inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pos_menu_items mi
      WHERE mi.id = pos_inventory_movements.item_id
        AND public.user_can_see_casino(auth.uid(), mi.casino_id)
        AND (public.has_role(auth.uid(),'pos_manager'::app_role)
             OR public.has_role(auth.uid(),'super_admin'::app_role))
    )
  );

CREATE OR REPLACE FUNCTION public.pos_inventory_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'pos_inventory_movements is immutable'; END $$;
CREATE TRIGGER trg_pos_inv_no_update BEFORE UPDATE OR DELETE ON public.pos_inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.pos_inventory_immutable();

CREATE OR REPLACE FUNCTION public.pos_inventory_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pos_menu_items
     SET stock_qty = COALESCE(stock_qty, 0) + NEW.delta,
         updated_at = now()
   WHERE id = NEW.item_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_inv_apply AFTER INSERT ON public.pos_inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.pos_inventory_apply();

-- ============================================================
-- Comp → Expense bridge
-- ============================================================
CREATE OR REPLACE FUNCTION public.pos_orders_after_insert_comp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expense_id uuid;
BEGIN
  IF NEW.payment_mode IN ('comp_player','comp_house') THEN
    INSERT INTO public.expenses (
      casino_id, category, amount, description, player_id, player_name,
      approved, created_by, business_date, cage_type
    ) VALUES (
      NEW.casino_id,
      'pos_comp'::expense_category,
      COALESCE(NEW.total_tzs, 0),
      'POS Comp · Order #' || substr(NEW.id::text,1,8)
        || CASE WHEN NEW.comp_reason IS NOT NULL THEN ' · ' || NEW.comp_reason ELSE '' END,
      NEW.player_id,
      COALESCE(NEW.player_name, ''),
      true,
      COALESCE(NEW.waiter_user_id, auth.uid()),
      NEW.business_date,
      'live'
    ) RETURNING id INTO v_expense_id;

    PERFORM set_config('pos.internal','on', true);
    UPDATE public.pos_orders SET expense_id = v_expense_id WHERE id = NEW.id;
    PERFORM set_config('pos.internal','', true);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_orders_comp_to_expense
  AFTER INSERT ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.pos_orders_after_insert_comp();

-- Update expense amount when order total changes via item inserts (internal updates only)
CREATE OR REPLACE FUNCTION public.pos_orders_sync_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.expense_id IS NOT NULL AND NEW.total_tzs IS DISTINCT FROM OLD.total_tzs THEN
    UPDATE public.expenses SET amount = NEW.total_tzs WHERE id = NEW.expense_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_orders_sync_expense
  AFTER UPDATE ON public.pos_orders
  FOR EACH ROW WHEN (NEW.expense_id IS NOT NULL)
  EXECUTE FUNCTION public.pos_orders_sync_expense();

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_order_items;
ALTER TABLE public.pos_orders REPLICA IDENTITY FULL;
ALTER TABLE public.pos_order_items REPLICA IDENTITY FULL;
