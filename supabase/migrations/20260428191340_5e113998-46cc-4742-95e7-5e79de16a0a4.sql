
-- =========================================================
-- 1. chip_initial_baseline (источник истины по номиналам)
-- =========================================================
CREATE TABLE public.chip_initial_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  denomination bigint NOT NULL,
  initial_quantity bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (casino_id, denomination)
);

ALTER TABLE public.chip_initial_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see initial baseline"
  ON public.chip_initial_baseline FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Surveillance sees initial baseline"
  ON public.chip_initial_baseline FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Super admins see all initial baseline"
  ON public.chip_initial_baseline FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers insert initial baseline"
  ON public.chip_initial_baseline FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND has_role(auth.uid(), 'manager'::app_role)
  );

-- UPDATE через emission trigger (SECURITY DEFINER), без публичной policy

CREATE TRIGGER trg_initial_baseline_updated_at
  BEFORE UPDATE ON public.chip_initial_baseline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. miss_chips (архив ушедших фишек)
-- =========================================================
CREATE TABLE public.miss_chips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  shift_id uuid REFERENCES public.shifts(id),
  business_date date NOT NULL,
  denomination bigint NOT NULL,
  quantity bigint NOT NULL,
  total_value_tzs bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_miss_chips_casino_date ON public.miss_chips (casino_id, business_date DESC);
CREATE INDEX idx_miss_chips_casino_denom ON public.miss_chips (casino_id, denomination);

ALTER TABLE public.miss_chips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers see miss chips"
  ON public.miss_chips FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
  );

CREATE POLICY "Surveillance sees miss chips"
  ON public.miss_chips FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Super admins see all miss chips"
  ON public.miss_chips FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- INSERT/UPDATE/DELETE запрещены публично — пишет только trigger через SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.prevent_miss_chips_modify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'miss_chips records are immutable';
END;
$$;

CREATE TRIGGER trg_prevent_miss_chips_update
  BEFORE UPDATE ON public.miss_chips
  FOR EACH ROW EXECUTE FUNCTION public.prevent_miss_chips_modify();

CREATE TRIGGER trg_prevent_miss_chips_delete
  BEFORE DELETE ON public.miss_chips
  FOR EACH ROW EXECUTE FUNCTION public.prevent_miss_chips_modify();

-- =========================================================
-- 3. chip_emissions (журнал докупок)
-- =========================================================
CREATE TABLE public.chip_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  denomination bigint NOT NULL,
  quantity_added bigint NOT NULL CHECK (quantity_added > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  operator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chip_emissions_casino ON public.chip_emissions (casino_id, created_at DESC);

ALTER TABLE public.chip_emissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers see chip emissions"
  ON public.chip_emissions FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Super admins see all chip emissions"
  ON public.chip_emissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers insert chip emissions"
  ON public.chip_emissions FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE OR REPLACE FUNCTION public.prevent_chip_emission_modify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'chip_emissions records are immutable';
END;
$$;

CREATE TRIGGER trg_prevent_emission_update
  BEFORE UPDATE ON public.chip_emissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_chip_emission_modify();

CREATE TRIGGER trg_prevent_emission_delete
  BEFORE DELETE ON public.chip_emissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_chip_emission_modify();

-- =========================================================
-- 4. Trigger: emission → upsert chip_initial_baseline + activity_log
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_chip_emission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chip_initial_baseline (casino_id, denomination, initial_quantity, created_by)
  VALUES (NEW.casino_id, NEW.denomination, NEW.quantity_added, NEW.operator_id)
  ON CONFLICT (casino_id, denomination)
  DO UPDATE SET
    initial_quantity = public.chip_initial_baseline.initial_quantity + EXCLUDED.initial_quantity,
    updated_at = now();

  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id, 'chip_emission', 'EMIT', NEW.operator_id,
    jsonb_build_object(
      'denomination', NEW.denomination,
      'quantity_added', NEW.quantity_added,
      'reason', NEW.reason,
      'emission_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_chip_emission
  AFTER INSERT ON public.chip_emissions
  FOR EACH ROW EXECUTE FUNCTION public.apply_chip_emission();

-- =========================================================
-- 5. Trigger: transactions → автоматическое движение фишек в кассе
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_chip_movement_from_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chip jsonb;
  v_denom bigint;
  v_qty bigint;
  v_delta bigint;
BEGIN
  IF NEW.chips IS NULL OR jsonb_typeof(NEW.chips) <> 'object' THEN
    RETURN NEW;
  END IF;

  -- IN/buy: фишки уходят из кассы к игроку (delta = -qty)
  -- OUT/cashout: фишки возвращаются в кассу от игрока (delta = +qty)
  FOR v_denom, v_qty IN
    SELECT (key)::bigint, (value)::bigint
    FROM jsonb_each_text(NEW.chips)
    WHERE value ~ '^[0-9]+$' AND (value)::bigint > 0
  LOOP
    IF NEW.type::text IN ('buy', 'in') THEN
      v_delta := -v_qty;
    ELSIF NEW.type::text IN ('cashout', 'out') THEN
      v_delta := v_qty;
    ELSE
      CONTINUE;
    END IF;

    INSERT INTO public.chip_inventory (casino_id, location_type, location_id, denomination, quantity, updated_by)
    VALUES (NEW.casino_id, 'cashier', NULL, v_denom, GREATEST(v_delta, 0), NEW.operator_id)
    ON CONFLICT DO NOTHING;

    UPDATE public.chip_inventory
    SET quantity = quantity + v_delta,
        updated_at = now(),
        updated_by = NEW.operator_id
    WHERE casino_id = NEW.casino_id
      AND location_type = 'cashier'
      AND location_id IS NULL
      AND denomination = v_denom;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Уникальный индекс для ON CONFLICT (cashier — единая локация без location_id)
CREATE UNIQUE INDEX IF NOT EXISTS chip_inventory_cashier_denom_uniq
  ON public.chip_inventory (casino_id, denomination)
  WHERE location_type = 'cashier' AND location_id IS NULL;

CREATE TRIGGER trg_apply_chip_movement
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_chip_movement_from_transaction();

-- =========================================================
-- 6. Trigger: при закрытии смены → финализация Floor в miss_chips
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_floor_to_miss_chips()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_inventory bigint;
  v_archived bigint;
  v_floor bigint;
  v_business_date date;
BEGIN
  IF NEW.status <> 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  v_business_date := get_business_date_for_casino(NEW.casino_id);

  FOR r IN
    SELECT denomination, initial_quantity
    FROM public.chip_initial_baseline
    WHERE casino_id = NEW.casino_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_inventory
    FROM public.chip_inventory
    WHERE casino_id = NEW.casino_id AND denomination = r.denomination;

    SELECT COALESCE(SUM(quantity), 0) INTO v_archived
    FROM public.miss_chips
    WHERE casino_id = NEW.casino_id AND denomination = r.denomination;

    -- Floor дельта данной смены = (Initial − Inventory) − уже архивированный Miss
    v_floor := (r.initial_quantity - v_inventory) - v_archived;

    IF v_floor <> 0 THEN
      INSERT INTO public.miss_chips
        (casino_id, shift_id, business_date, denomination, quantity, total_value_tzs)
      VALUES
        (NEW.casino_id, NEW.id, v_business_date, r.denomination, v_floor, v_floor * r.denomination);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_finalize_floor_on_shift_close
  AFTER UPDATE OF status ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.finalize_floor_to_miss_chips();

-- =========================================================
-- 7. View: live статус фишек по номиналам
-- =========================================================
CREATE OR REPLACE VIEW public.chip_conservation_status AS
SELECT
  cib.casino_id,
  cib.denomination,
  cib.initial_quantity,
  COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
            WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0) AS in_locations,
  COALESCE((SELECT SUM(quantity) FROM public.miss_chips mc
            WHERE mc.casino_id = cib.casino_id AND mc.denomination = cib.denomination), 0) AS archived_miss,
  cib.initial_quantity
    - COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
                WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0)
    - COALESCE((SELECT SUM(quantity) FROM public.miss_chips mc
                WHERE mc.casino_id = cib.casino_id AND mc.denomination = cib.denomination), 0) AS live_floor
FROM public.chip_initial_baseline cib;
