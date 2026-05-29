-- POS Bar M8: Purchases + moving-average cost + auto cage expense

ALTER TABLE public.pos_menu_items
  ADD COLUMN IF NOT EXISTS avg_cost_tzs NUMERIC(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_cost_tzs NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;

CREATE TABLE public.pos_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('bulk','single')),
  bartender_user_id UUID NOT NULL REFERENCES auth.users(id),
  supplier TEXT,
  notes TEXT NOT NULL DEFAULT '',
  total_tzs BIGINT NOT NULL DEFAULT 0,
  expense_id UUID REFERENCES public.expenses(id),
  business_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_purchases_casino_date ON public.pos_purchases(casino_id, business_date DESC);
CREATE INDEX idx_pos_purchases_bartender ON public.pos_purchases(bartender_user_id);

GRANT SELECT, INSERT ON public.pos_purchases TO authenticated;
GRANT ALL ON public.pos_purchases TO service_role;

ALTER TABLE public.pos_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_purchases_select" ON public.pos_purchases
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "pos_purchases_insert" ON public.pos_purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND bartender_user_id = auth.uid()
    AND (
      has_role(auth.uid(),'pos_bartender'::app_role)
      OR has_role(auth.uid(),'pos_manager'::app_role)
      OR has_role(auth.uid(),'cashier_slots'::app_role)
      OR is_manager_op(auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.pos_purchase_block_modify()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.pos_purchase_internal', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'pos_purchases are immutable';
END;
$$;

CREATE TRIGGER no_update_pos_purchases BEFORE UPDATE ON public.pos_purchases
  FOR EACH ROW EXECUTE FUNCTION public.pos_purchase_block_modify();
CREATE TRIGGER no_delete_pos_purchases BEFORE DELETE ON public.pos_purchases
  FOR EACH ROW EXECUTE FUNCTION public.pos_purchase_block_modify();

CREATE TABLE public.pos_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.pos_purchases(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pos_menu_items(id) ON DELETE RESTRICT,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_cost_tzs NUMERIC(14,4) NOT NULL CHECK (unit_cost_tzs >= 0),
  line_total_tzs BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_purchase_items_purchase ON public.pos_purchase_items(purchase_id);
CREATE INDEX idx_pos_purchase_items_item ON public.pos_purchase_items(item_id);

GRANT SELECT, INSERT ON public.pos_purchase_items TO authenticated;
GRANT ALL ON public.pos_purchase_items TO service_role;

ALTER TABLE public.pos_purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_purchase_items_select" ON public.pos_purchase_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pos_purchases p
    WHERE p.id = purchase_id AND p.casino_id = get_user_casino_id(auth.uid())
  ));

CREATE POLICY "pos_purchase_items_insert" ON public.pos_purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pos_purchases p
    WHERE p.id = purchase_id
      AND p.casino_id = get_user_casino_id(auth.uid())
      AND p.bartender_user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.pos_create_purchase(_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id UUID := (_payload->>'casino_id')::UUID;
  v_type TEXT := COALESCE(_payload->>'purchase_type', 'single');
  v_supplier TEXT := _payload->>'supplier';
  v_notes TEXT := COALESCE(_payload->>'notes', '');
  v_user UUID := auth.uid();
  v_bd DATE;
  v_purchase_id UUID;
  v_total BIGINT := 0;
  v_expense_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_qty NUMERIC;
  v_unit_cost NUMERIC(14,4);
  v_line BIGINT;
  v_cur_stock NUMERIC;
  v_cur_avg NUMERIC(14,4);
  v_prev_stock NUMERIC;
  v_new_avg NUMERIC(14,4);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_casino_id IS NULL THEN RAISE EXCEPTION 'casino_id required'; END IF;
  IF v_casino_id <> get_user_casino_id(v_user) THEN RAISE EXCEPTION 'Casino mismatch'; END IF;
  IF v_type NOT IN ('bulk','single') THEN RAISE EXCEPTION 'Invalid purchase_type'; END IF;
  IF jsonb_array_length(COALESCE(_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  v_bd := get_current_business_date(v_casino_id);

  INSERT INTO public.pos_purchases(
    casino_id, purchase_type, bartender_user_id, supplier, notes, business_date
  ) VALUES (
    v_casino_id, v_type, v_user, NULLIF(v_supplier,''), v_notes, v_bd
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_payload->'items')
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_qty := (v_item->>'qty')::NUMERIC;
    v_unit_cost := (v_item->>'unit_cost_tzs')::NUMERIC;

    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'qty must be > 0 (item %)', v_item_id; END IF;
    IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN RAISE EXCEPTION 'unit_cost_tzs must be >= 0 (item %)', v_item_id; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pos_menu_items WHERE id = v_item_id AND casino_id = v_casino_id) THEN
      RAISE EXCEPTION 'Item % not in casino', v_item_id;
    END IF;

    v_line := FLOOR(v_qty * v_unit_cost)::BIGINT;
    v_total := v_total + v_line;

    INSERT INTO public.pos_purchase_items(purchase_id, item_id, qty, unit_cost_tzs, line_total_tzs)
    VALUES (v_purchase_id, v_item_id, v_qty, v_unit_cost, v_line);

    INSERT INTO public.pos_inventory_movements(item_id, delta, reason, user_id)
    VALUES (v_item_id, v_qty, 'purchase', v_user);

    SELECT COALESCE(stock_qty,0), COALESCE(avg_cost_tzs,0)
      INTO v_cur_stock, v_cur_avg
      FROM public.pos_menu_items WHERE id = v_item_id;

    v_prev_stock := GREATEST(v_cur_stock - v_qty, 0);
    IF (v_prev_stock + v_qty) > 0 THEN
      v_new_avg := ((v_prev_stock * v_cur_avg) + (v_qty * v_unit_cost)) / (v_prev_stock + v_qty);
    ELSE
      v_new_avg := v_unit_cost;
    END IF;

    UPDATE public.pos_menu_items
      SET avg_cost_tzs = v_new_avg,
          last_purchase_cost_tzs = v_unit_cost,
          last_purchase_at = now(),
          updated_at = now()
      WHERE id = v_item_id;
  END LOOP;

  INSERT INTO public.expenses(
    casino_id, category, amount, description,
    approved, created_by, cage_type, business_date
  ) VALUES (
    v_casino_id,
    'alcohol'::expense_category,
    v_total,
    'Bar purchase (' || v_type || ')'
      || CASE WHEN v_supplier IS NOT NULL AND v_supplier <> '' THEN ' — ' || v_supplier ELSE '' END
      || CASE WHEN v_notes <> '' THEN ' — ' || v_notes ELSE '' END,
    false,
    v_user,
    'slots',
    v_bd
  )
  RETURNING id INTO v_expense_id;

  PERFORM set_config('app.pos_purchase_internal', 'on', true);
  UPDATE public.pos_purchases SET total_tzs = v_total, expense_id = v_expense_id WHERE id = v_purchase_id;
  PERFORM set_config('app.pos_purchase_internal', 'off', true);

  RETURN v_purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_create_purchase(JSONB) TO authenticated;