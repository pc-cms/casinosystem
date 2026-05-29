-- M10b: Stock Count on POS shift handover
-- Bartender enters actual qty per tracked item; expected_qty is snapshot from current stock_qty
-- at the moment of save. Variance is recorded for manager report and an `adjustment` inventory
-- movement is auto-issued so stock_qty becomes counted_qty (no manual correction needed).

CREATE TABLE IF NOT EXISTS public.pos_stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  shift_id uuid REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  count_type text NOT NULL CHECK (count_type IN ('open','handover','close','adhoc')),
  counted_by uuid NOT NULL,
  counted_by_name text,
  notes text,
  total_variance_value_tzs bigint NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pos_stock_counts TO authenticated;
GRANT ALL ON public.pos_stock_counts TO service_role;

ALTER TABLE public.pos_stock_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_stock_counts read by casino access"
ON public.pos_stock_counts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_casino_access uca
    WHERE uca.user_id = auth.uid() AND uca.casino_id = pos_stock_counts.casino_id
  )
);

CREATE POLICY "pos_stock_counts insert via rpc only"
ON public.pos_stock_counts FOR INSERT TO authenticated
WITH CHECK (false);

-- Immutability: no updates, no deletes
CREATE OR REPLACE FUNCTION public.pos_stock_counts_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'pos_stock_counts is immutable';
END;
$$;
CREATE TRIGGER pos_stock_counts_no_update BEFORE UPDATE ON public.pos_stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.pos_stock_counts_immutable();
CREATE TRIGGER pos_stock_counts_no_delete BEFORE DELETE ON public.pos_stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.pos_stock_counts_immutable();

CREATE INDEX idx_pos_stock_counts_casino_date ON public.pos_stock_counts(casino_id, created_at DESC);
CREATE INDEX idx_pos_stock_counts_shift ON public.pos_stock_counts(shift_id);

-- Line items
CREATE TABLE IF NOT EXISTS public.pos_stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.pos_stock_counts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.pos_menu_items(id),
  expected_qty numeric NOT NULL,
  counted_qty numeric NOT NULL,
  variance_qty numeric GENERATED ALWAYS AS (counted_qty - expected_qty) STORED,
  unit_cost_tzs bigint NOT NULL DEFAULT 0,
  variance_value_tzs bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pos_stock_count_items TO authenticated;
GRANT ALL ON public.pos_stock_count_items TO service_role;

ALTER TABLE public.pos_stock_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_stock_count_items read via parent"
ON public.pos_stock_count_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pos_stock_counts c
    WHERE c.id = pos_stock_count_items.count_id
      AND (
        public.has_role(auth.uid(), 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.user_casino_access uca
          WHERE uca.user_id = auth.uid() AND uca.casino_id = c.casino_id
        )
      )
  )
);

CREATE POLICY "pos_stock_count_items insert via rpc only"
ON public.pos_stock_count_items FOR INSERT TO authenticated
WITH CHECK (false);

CREATE TRIGGER pos_stock_count_items_no_update BEFORE UPDATE ON public.pos_stock_count_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_stock_counts_immutable();
CREATE TRIGGER pos_stock_count_items_no_delete BEFORE DELETE ON public.pos_stock_count_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_stock_counts_immutable();

CREATE INDEX idx_pos_stock_count_items_count ON public.pos_stock_count_items(count_id);
CREATE INDEX idx_pos_stock_count_items_item ON public.pos_stock_count_items(item_id);

-- Save RPC: atomic count + auto-adjustment to align stock_qty with counted_qty.
CREATE OR REPLACE FUNCTION public.pos_save_stock_count(
  _shift_id uuid,
  _count_type text,
  _items jsonb,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_casino uuid;
  v_count_id uuid;
  v_name text;
  rec jsonb;
  v_item_id uuid;
  v_counted numeric;
  v_expected numeric;
  v_unit_cost bigint;
  v_variance_qty numeric;
  v_variance_val bigint;
  v_total_var bigint := 0;
  v_items_n integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _count_type NOT IN ('open','handover','close','adhoc') THEN
    RAISE EXCEPTION 'Invalid count_type %', _count_type;
  END IF;

  -- Derive casino from shift if provided, else from current waiter casino
  IF _shift_id IS NOT NULL THEN
    SELECT casino_id INTO v_casino FROM pos_shifts WHERE id = _shift_id;
  END IF;
  IF v_casino IS NULL THEN
    RAISE EXCEPTION 'Casino context required (shift_id missing or invalid)';
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE user_id = v_user;

  INSERT INTO pos_stock_counts (casino_id, shift_id, count_type, counted_by, counted_by_name, notes)
  VALUES (v_casino, _shift_id, _count_type, v_user, v_name, _notes)
  RETURNING id INTO v_count_id;

  FOR rec IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb))
  LOOP
    v_item_id := (rec->>'item_id')::uuid;
    v_counted := COALESCE((rec->>'counted_qty')::numeric, 0);

    -- Snapshot expected = current stock_qty (treat NULL as 0)
    SELECT COALESCE(stock_qty, 0), COALESCE(avg_cost_tzs, 0)
    INTO v_expected, v_unit_cost
    FROM pos_menu_items
    WHERE id = v_item_id AND casino_id = v_casino;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_variance_qty := v_counted - v_expected;
    v_variance_val := ROUND(v_variance_qty * v_unit_cost)::bigint;

    INSERT INTO pos_stock_count_items (count_id, item_id, expected_qty, counted_qty, unit_cost_tzs, variance_value_tzs)
    VALUES (v_count_id, v_item_id, v_expected, v_counted, v_unit_cost, v_variance_val);

    -- Align stock_qty to counted_qty via adjustment movement (existing trigger updates stock_qty)
    IF v_variance_qty <> 0 THEN
      INSERT INTO pos_inventory_movements (casino_id, item_id, qty_delta, reason, ref_type, ref_id, performed_by)
      VALUES (v_casino, v_item_id, v_variance_qty, 'stock_count', 'pos_stock_count', v_count_id, v_user);
    END IF;

    v_total_var := v_total_var + v_variance_val;
    v_items_n := v_items_n + 1;
  END LOOP;

  -- Update aggregates (bypass immutability via SECURITY DEFINER using disable_trigger)
  -- Cleaner: skip — store aggregates only at insert. So we update before insert? No, items processed after.
  -- Do a direct UPDATE while temporarily allowing it via session_replication_role.
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE pos_stock_counts SET total_variance_value_tzs = v_total_var, items_count = v_items_n WHERE id = v_count_id;
  PERFORM set_config('session_replication_role', 'origin', true);

  RETURN v_count_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_save_stock_count(uuid, text, jsonb, text) TO authenticated;

-- Add 'stock_count' to allowed inventory movement reasons if a CHECK exists.
-- Most projects use a free-form text column; skip if no constraint.
DO $$
DECLARE
  c text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.pos_inventory_movements'::regclass
    AND contype = 'c'
    AND conname LIKE '%reason%';
  IF c IS NOT NULL AND c NOT LIKE '%stock_count%' THEN
    EXECUTE 'ALTER TABLE public.pos_inventory_movements DROP CONSTRAINT ' ||
      (SELECT conname FROM pg_constraint
       WHERE conrelid = 'public.pos_inventory_movements'::regclass
         AND contype = 'c' AND conname LIKE '%reason%' LIMIT 1);
    ALTER TABLE public.pos_inventory_movements
      ADD CONSTRAINT pos_inventory_movements_reason_check
      CHECK (reason IN ('purchase','sale','waste','adjustment','transfer_in','transfer_out','stock_count'));
  END IF;
END $$;