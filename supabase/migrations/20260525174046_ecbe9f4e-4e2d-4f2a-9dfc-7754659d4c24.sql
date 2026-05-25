
-- ============================================================
-- CAGE SLOTS MODULE — schema, RLS, RPC, recompute trigger
-- ============================================================

-- ----- Enums --------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.cage_slots_status AS ENUM
    ('draft','open','ready_for_review','approved','closed','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cage_slots_shift_type AS ENUM ('day','night');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cage_slots_inventory_type AS ENUM ('opening','closing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cage_slots_count_type AS ENUM ('opening','check','closing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cage_slots_comment_type AS ENUM
    ('cashier_note','manager_comment','reversal_reason');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- Settings per casino ------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL UNIQUE REFERENCES public.casinos(id) ON DELETE CASCADE,
  card_deposit_value_tzs bigint NOT NULL DEFAULT 5000 CHECK (card_deposit_value_tzs > 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cage_slots_settings (casino_id)
SELECT c.id FROM public.casinos c
WHERE NOT EXISTS (SELECT 1 FROM public.cage_slots_settings s WHERE s.casino_id = c.id);

-- ----- Shifts -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  business_date date NOT NULL,
  shift_type public.cage_slots_shift_type NOT NULL,
  cashier_id uuid NOT NULL,
  status public.cage_slots_status NOT NULL DEFAULT 'open',
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  system_shift_result bigint,
  actual_cage_result bigint,
  difference_amount bigint,
  manager_comment text,
  cashier_note text,
  reverses_id uuid REFERENCES public.cage_slots_shifts(id),
  client_uuid uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cage_slots_shifts_casino_date
  ON public.cage_slots_shifts (casino_id, business_date DESC, shift_type);
CREATE INDEX IF NOT EXISTS idx_cage_slots_shifts_status
  ON public.cage_slots_shifts (casino_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cage_slots_one_open_per_slot
  ON public.cage_slots_shifts (casino_id, business_date, shift_type)
  WHERE status IN ('open','draft','ready_for_review');

-- ----- Exchange rates -----------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  currency_code text NOT NULL,
  rate_to_tzs numeric NOT NULL CHECK (rate_to_tzs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cage_slots_shift_id, currency_code)
);

-- ----- Cash inventory rows ------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_cash_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  inventory_type public.cage_slots_inventory_type NOT NULL,
  currency_code text NOT NULL,
  denomination bigint NOT NULL CHECK (denomination > 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate_to_tzs numeric NOT NULL DEFAULT 1 CHECK (rate_to_tzs >= 0),
  total_currency bigint NOT NULL DEFAULT 0,
  total_tzs bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cage_slots_shift_id, inventory_type, currency_code, denomination)
);

CREATE INDEX IF NOT EXISTS idx_cage_slots_cash_inventory_shift
  ON public.cage_slots_cash_inventory (cage_slots_shift_id);

-- BEFORE trigger to maintain total_currency / total_tzs
CREATE OR REPLACE FUNCTION public.trg_cs_inv_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_currency := NEW.denomination * NEW.quantity;
  NEW.total_tzs := (NEW.total_currency::numeric * NEW.rate_to_tzs)::bigint;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cs_inv_totals_bi ON public.cage_slots_cash_inventory;
CREATE TRIGGER trg_cs_inv_totals_bi
  BEFORE INSERT OR UPDATE ON public.cage_slots_cash_inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_cs_inv_totals();

-- ----- Plastic cards ------------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_slots_shift_id uuid NOT NULL UNIQUE REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  opening_card_count integer NOT NULL DEFAULT 0,
  closing_card_count integer,
  miss_card_count integer,
  card_deposit_value_tzs bigint NOT NULL DEFAULT 5000 CHECK (card_deposit_value_tzs > 0),
  card_balance_effect_tzs bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----- Cash count snapshots -----------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  count_type public.cage_slots_count_type NOT NULL,
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_tzs bigint NOT NULL DEFAULT 0,
  counted_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cage_slots_cash_counts_shift
  ON public.cage_slots_cash_counts (cage_slots_shift_id, created_at DESC);

-- ----- Comments -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.cage_slots_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  comment_type public.cage_slots_comment_type NOT NULL,
  comment_text text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----- Cashless link ------------------------------------------
ALTER TABLE public.cashless_transactions
  ADD COLUMN IF NOT EXISTS cage_slots_shift_id uuid REFERENCES public.cage_slots_shifts(id),
  ADD COLUMN IF NOT EXISTS source_module text;

CREATE INDEX IF NOT EXISTS idx_cashless_cage_slots_shift
  ON public.cashless_transactions (cage_slots_shift_id)
  WHERE cage_slots_shift_id IS NOT NULL;

-- ============================================================
-- updated_at touch
-- ============================================================
CREATE OR REPLACE FUNCTION public.cs_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cs_shifts_touch ON public.cage_slots_shifts;
CREATE TRIGGER trg_cs_shifts_touch BEFORE UPDATE ON public.cage_slots_shifts
  FOR EACH ROW EXECUTE FUNCTION public.cs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cs_settings_touch ON public.cage_slots_settings;
CREATE TRIGGER trg_cs_settings_touch BEFORE UPDATE ON public.cage_slots_settings
  FOR EACH ROW EXECUTE FUNCTION public.cs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cs_cards_touch ON public.cage_slots_cards;
CREATE TRIGGER trg_cs_cards_touch BEFORE UPDATE ON public.cage_slots_cards
  FOR EACH ROW EXECUTE FUNCTION public.cs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cs_inv_touch ON public.cage_slots_cash_inventory;
CREATE TRIGGER trg_cs_inv_touch BEFORE UPDATE ON public.cage_slots_cash_inventory
  FOR EACH ROW EXECUTE FUNCTION public.cs_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cs_rates_touch ON public.cage_slots_exchange_rates;
CREATE TRIGGER trg_cs_rates_touch BEFORE UPDATE ON public.cage_slots_exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.cs_touch_updated_at();

-- ============================================================
-- compute_cage_slots_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_cage_slots_balance(p_shift_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_open_cash bigint := 0;
  v_close_cash bigint := 0;
  v_open_cards int := 0;
  v_close_cards int := 0;
  v_deposit bigint := 5000;
  v_in bigint := 0;
  v_out bigint := 0;
  v_system bigint := 0;
  v_open_cards_tzs bigint;
  v_close_cards_tzs bigint;
  v_movement bigint;
  v_net bigint;
  v_actual bigint;
  v_diff bigint;
BEGIN
  SELECT COALESCE(SUM(total_tzs),0) INTO v_open_cash
    FROM public.cage_slots_cash_inventory
    WHERE cage_slots_shift_id=p_shift_id AND inventory_type='opening';
  SELECT COALESCE(SUM(total_tzs),0) INTO v_close_cash
    FROM public.cage_slots_cash_inventory
    WHERE cage_slots_shift_id=p_shift_id AND inventory_type='closing';

  SELECT COALESCE(opening_card_count,0), COALESCE(closing_card_count,0), COALESCE(card_deposit_value_tzs,5000)
    INTO v_open_cards, v_close_cards, v_deposit
    FROM public.cage_slots_cards WHERE cage_slots_shift_id=p_shift_id;

  v_open_cards_tzs := v_open_cards::bigint * v_deposit;
  v_close_cards_tzs := v_close_cards::bigint * v_deposit;

  SELECT
    COALESCE(SUM(CASE WHEN direction='IN'  THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction='OUT' THEN amount ELSE 0 END), 0)
  INTO v_in, v_out
  FROM public.cashless_transactions
  WHERE cage_slots_shift_id=p_shift_id;

  v_net := v_in - v_out;
  v_movement := (v_close_cash + v_close_cards_tzs) - (v_open_cash + v_open_cards_tzs);
  v_actual := v_movement - v_net;

  SELECT COALESCE(system_shift_result,0) INTO v_system
    FROM public.cage_slots_shifts WHERE id=p_shift_id;
  v_diff := v_actual - v_system;

  RETURN jsonb_build_object(
    'opening_cash_total_tzs', v_open_cash,
    'closing_cash_total_tzs', v_close_cash,
    'opening_cards_count', v_open_cards,
    'closing_cards_count', v_close_cards,
    'miss_cards_count', v_close_cards - v_open_cards,
    'card_deposit_value_tzs', v_deposit,
    'opening_cards_tzs', v_open_cards_tzs,
    'closing_cards_tzs', v_close_cards_tzs,
    'cashless_in_tzs', v_in,
    'cashless_out_tzs', v_out,
    'cashless_net_tzs', v_net,
    'cash_movement_tzs', v_movement,
    'actual_cage_result', v_actual,
    'system_shift_result', v_system,
    'difference_amount', v_diff,
    'balanced', v_diff = 0
  );
END $$;

-- ============================================================
-- Recompute trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_cs_recompute()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_shift_id uuid;
  v_res jsonb;
BEGIN
  v_shift_id := COALESCE(
    CASE WHEN TG_OP='DELETE' THEN OLD.cage_slots_shift_id ELSE NEW.cage_slots_shift_id END
  );
  IF v_shift_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  v_res := public.compute_cage_slots_balance(v_shift_id);

  UPDATE public.cage_slots_shifts SET
    actual_cage_result = (v_res->>'actual_cage_result')::bigint,
    difference_amount  = (v_res->>'difference_amount')::bigint
  WHERE id = v_shift_id;

  IF TG_TABLE_NAME = 'cage_slots_cards' THEN
    UPDATE public.cage_slots_cards SET
      miss_card_count = (v_res->>'miss_cards_count')::int,
      card_balance_effect_tzs = ((v_res->>'closing_cards_tzs')::bigint - (v_res->>'opening_cards_tzs')::bigint)
    WHERE cage_slots_shift_id = v_shift_id
      AND (miss_card_count IS DISTINCT FROM (v_res->>'miss_cards_count')::int
           OR card_balance_effect_tzs IS DISTINCT FROM ((v_res->>'closing_cards_tzs')::bigint - (v_res->>'opening_cards_tzs')::bigint));
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_cs_recompute_inv ON public.cage_slots_cash_inventory;
CREATE TRIGGER trg_cs_recompute_inv
  AFTER INSERT OR UPDATE OR DELETE ON public.cage_slots_cash_inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_cs_recompute();

DROP TRIGGER IF EXISTS trg_cs_recompute_cards ON public.cage_slots_cards;
CREATE TRIGGER trg_cs_recompute_cards
  AFTER INSERT OR UPDATE OR DELETE ON public.cage_slots_cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_cs_recompute();

-- Cashless link/unlink triggers recompute
CREATE OR REPLACE FUNCTION public.trg_cs_recompute_cashless()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_shift uuid; v_res jsonb;
BEGIN
  v_shift := COALESCE(NEW.cage_slots_shift_id, OLD.cage_slots_shift_id);
  IF v_shift IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  v_res := public.compute_cage_slots_balance(v_shift);
  UPDATE public.cage_slots_shifts SET
    actual_cage_result = (v_res->>'actual_cage_result')::bigint,
    difference_amount  = (v_res->>'difference_amount')::bigint
  WHERE id = v_shift;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_cs_recompute_cashless ON public.cashless_transactions;
CREATE TRIGGER trg_cs_recompute_cashless
  AFTER INSERT OR UPDATE OR DELETE ON public.cashless_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_cs_recompute_cashless();

-- system_shift_result change → recompute self (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.trg_cs_recompute_self()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_res jsonb;
BEGIN
  IF NEW.system_shift_result IS DISTINCT FROM OLD.system_shift_result THEN
    v_res := public.compute_cage_slots_balance(NEW.id);
    NEW.actual_cage_result := (v_res->>'actual_cage_result')::bigint;
    NEW.difference_amount  := (v_res->>'difference_amount')::bigint;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cs_recompute_self ON public.cage_slots_shifts;
CREATE TRIGGER trg_cs_recompute_self
  BEFORE UPDATE ON public.cage_slots_shifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_cs_recompute_self();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.cage_slots_shifts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_exchange_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_cash_inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_cash_counts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cage_slots_settings          ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cs_can_view(_casino uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (_casino = public.get_user_casino_id(auth.uid()))
     AND (
       public.has_role(auth.uid(),'cashier'::public.app_role)
       OR public.has_role(auth.uid(),'manager'::public.app_role)
       OR public.has_role(auth.uid(),'floor_manager'::public.app_role)
       OR public.has_role(auth.uid(),'finance_manager'::public.app_role)
       OR public.has_role(auth.uid(),'pit'::public.app_role)
     )
  OR public.has_role(auth.uid(),'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.cs_can_write(_casino uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (_casino = public.get_user_casino_id(auth.uid()))
     AND (
       public.has_role(auth.uid(),'cashier'::public.app_role)
       OR public.has_role(auth.uid(),'manager'::public.app_role)
       OR public.has_role(auth.uid(),'floor_manager'::public.app_role)
     )
  OR public.has_role(auth.uid(),'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.cs_can_approve(_casino uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (_casino = public.get_user_casino_id(auth.uid()))
     AND (
       public.has_role(auth.uid(),'manager'::public.app_role)
       OR public.has_role(auth.uid(),'floor_manager'::public.app_role)
     )
  OR public.has_role(auth.uid(),'super_admin'::public.app_role)
$$;

DROP POLICY IF EXISTS cs_shifts_select ON public.cage_slots_shifts;
CREATE POLICY cs_shifts_select ON public.cage_slots_shifts FOR SELECT
  TO authenticated USING (public.cs_can_view(casino_id));

DROP POLICY IF EXISTS cs_shifts_insert ON public.cage_slots_shifts;
CREATE POLICY cs_shifts_insert ON public.cage_slots_shifts FOR INSERT
  TO authenticated WITH CHECK (public.cs_can_write(casino_id) AND opened_by = auth.uid());

DROP POLICY IF EXISTS cs_shifts_update ON public.cage_slots_shifts;
CREATE POLICY cs_shifts_update ON public.cage_slots_shifts FOR UPDATE
  TO authenticated
  USING (public.cs_can_write(casino_id) AND status NOT IN ('closed','approved','reversed'))
  WITH CHECK (public.cs_can_write(casino_id));

DROP POLICY IF EXISTS cs_shifts_approve ON public.cage_slots_shifts;
CREATE POLICY cs_shifts_approve ON public.cage_slots_shifts FOR UPDATE
  TO authenticated
  USING (public.cs_can_approve(casino_id))
  WITH CHECK (public.cs_can_approve(casino_id));

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'cage_slots_exchange_rates',
      'cage_slots_cash_inventory',
      'cage_slots_cards',
      'cage_slots_cash_counts',
      'cage_slots_comments'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS cs_%I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY cs_%I_select ON public.%I FOR SELECT TO authenticated USING (public.cs_can_view(casino_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS cs_%I_insert ON public.%I', t, t);
    EXECUTE format('CREATE POLICY cs_%I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.cs_can_write(casino_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS cs_%I_update ON public.%I', t, t);
    EXECUTE format('CREATE POLICY cs_%I_update ON public.%I FOR UPDATE TO authenticated USING (public.cs_can_write(casino_id)) WITH CHECK (public.cs_can_write(casino_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS cs_%I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY cs_%I_delete ON public.%I FOR DELETE TO authenticated USING (public.cs_can_write(casino_id))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS cs_settings_select ON public.cage_slots_settings;
CREATE POLICY cs_settings_select ON public.cage_slots_settings FOR SELECT
  TO authenticated USING (public.cs_can_view(casino_id));
DROP POLICY IF EXISTS cs_settings_update ON public.cage_slots_settings;
CREATE POLICY cs_settings_update ON public.cage_slots_settings FOR UPDATE
  TO authenticated USING (public.cs_can_approve(casino_id))
  WITH CHECK (public.cs_can_approve(casino_id));
DROP POLICY IF EXISTS cs_settings_insert ON public.cage_slots_settings;
CREATE POLICY cs_settings_insert ON public.cage_slots_settings FOR INSERT
  TO authenticated WITH CHECK (public.cs_can_approve(casino_id));

-- ============================================================
-- Role module defaults — sidebar visibility
-- ============================================================
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('cashier'::public.app_role,         'cage_slots', true,  true,  'today'::public.day_horizon),
  ('manager'::public.app_role,         'cage_slots', true,  true,  'all'::public.day_horizon),
  ('floor_manager'::public.app_role,   'cage_slots', true,  true,  'all'::public.day_horizon),
  ('pit'::public.app_role,             'cage_slots', true,  false, 'today'::public.day_horizon),
  ('finance_manager'::public.app_role, 'cage_slots', true,  false, 'all'::public.day_horizon),
  ('super_admin'::public.app_role,     'cage_slots', true,  true,  'all'::public.day_horizon)
ON CONFLICT (role, module_key) DO NOTHING;
