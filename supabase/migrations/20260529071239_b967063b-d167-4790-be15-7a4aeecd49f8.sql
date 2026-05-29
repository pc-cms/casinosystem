
-- 1. pos_tabs table
CREATE TABLE public.pos_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id),
  business_date date,
  opened_by_user_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id uuid,
  player_id uuid REFERENCES public.players(id),
  player_name text,
  walkin_label text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','voided')),
  total_tzs bigint NOT NULL DEFAULT 0,
  payment_split jsonb,
  expense_id uuid,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_id IS NOT NULL OR walkin_label IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE ON public.pos_tabs TO authenticated;
GRANT ALL ON public.pos_tabs TO service_role;

CREATE INDEX idx_pos_tabs_shift ON public.pos_tabs (casino_id, shift_id, status);
CREATE INDEX idx_pos_tabs_player ON public.pos_tabs (casino_id, player_id, status) WHERE player_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pos_tabs_open_per_player ON public.pos_tabs (shift_id, player_id) WHERE status = 'open' AND player_id IS NOT NULL;

ALTER TABLE public.pos_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_tabs_select" ON public.pos_tabs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      public.user_can_see_casino(auth.uid(), casino_id)
      AND (
        public.has_any_pos_role(auth.uid())
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'finance_manager'::app_role)
        OR public.has_role(auth.uid(), 'pit'::app_role)
      )
    )
  );

CREATE POLICY "pos_tabs_insert" ON public.pos_tabs FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'pos_waiter'::app_role)
      OR public.has_role(auth.uid(), 'pos_manager'::app_role)
      OR public.has_role(auth.uid(), 'pit'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "pos_tabs_update" ON public.pos_tabs FOR UPDATE TO authenticated
  USING (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'pos_waiter'::app_role)
      OR public.has_role(auth.uid(), 'pos_manager'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 2. Drop old comp-bridge triggers/functions + dependent pos_orders policies
DROP TRIGGER IF EXISTS trg_pos_orders_comp_to_expense ON public.pos_orders;
DROP TRIGGER IF EXISTS trg_pos_orders_sync_expense ON public.pos_orders;
DROP FUNCTION IF EXISTS public.pos_orders_after_insert_comp();
DROP FUNCTION IF EXISTS public.pos_orders_sync_expense();
DROP POLICY IF EXISTS "pos_orders_insert" ON public.pos_orders;

-- 3. Refactor pos_orders columns (table empty — safe to drop/rename)
ALTER TABLE public.pos_orders
  DROP COLUMN payment_mode,
  DROP COLUMN player_id,
  DROP COLUMN player_name,
  DROP COLUMN table_id,
  DROP COLUMN table_label,
  DROP COLUMN comp_reason,
  DROP COLUMN expense_id;

ALTER TABLE public.pos_orders
  ADD COLUMN tab_id uuid NOT NULL REFERENCES public.pos_tabs(id),
  ADD COLUMN voided_reason text;

CREATE INDEX idx_pos_orders_tab ON public.pos_orders (tab_id);

-- Recreate insert policy without payment_mode reference (auth via tab)
CREATE POLICY "pos_orders_insert" ON public.pos_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      (public.has_role(auth.uid(), 'pos_waiter'::app_role) AND waiter_user_id = auth.uid())
      OR public.has_role(auth.uid(), 'pos_manager'::app_role)
      OR public.has_role(auth.uid(), 'pit'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 4. Rewrite pos_orders guard
CREATE OR REPLACE FUNCTION public.pos_orders_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_internal text;
  v_rank_old int;
  v_rank_new int;
BEGIN
  v_internal := current_setting('pos.internal', true);
  IF TG_OP = 'UPDATE' AND COALESCE(v_internal,'') <> 'on' THEN
    IF NEW.total_tzs IS DISTINCT FROM OLD.total_tzs
       OR NEW.tab_id IS DISTINCT FROM OLD.tab_id
       OR NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.waiter_user_id IS DISTINCT FROM OLD.waiter_user_id
       OR NEW.business_date IS DISTINCT FROM OLD.business_date
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'pos_orders: financial/identity fields are immutable.';
    END IF;

    v_rank_old := CASE OLD.status
      WHEN 'pending' THEN 0 WHEN 'preparing' THEN 1 WHEN 'ready' THEN 2
      WHEN 'served' THEN 3 WHEN 'void' THEN 9 END;
    v_rank_new := CASE NEW.status
      WHEN 'pending' THEN 0 WHEN 'preparing' THEN 1 WHEN 'ready' THEN 2
      WHEN 'served' THEN 3 WHEN 'void' THEN 9 END;

    IF NEW.status = 'void' THEN
      IF OLD.status NOT IN ('pending','preparing') THEN
        RAISE EXCEPTION 'pos_orders: void allowed only while pending or preparing.';
      END IF;
    ELSIF v_rank_new < v_rank_old THEN
      RAISE EXCEPTION 'pos_orders: status can only move forward.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 5. Tab total recomputation
CREATE OR REPLACE FUNCTION public.pos_tabs_recompute_total(_tab_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_total bigint;
BEGIN
  SELECT COALESCE(SUM(total_tzs), 0)
    INTO v_total
    FROM public.pos_orders
   WHERE tab_id = _tab_id AND status <> 'void';

  PERFORM set_config('pos.internal','on', true);
  UPDATE public.pos_tabs SET total_tzs = v_total, updated_at = now() WHERE id = _tab_id;
  PERFORM set_config('pos.internal','', true);
END $function$;

CREATE OR REPLACE FUNCTION public.pos_orders_after_change_recompute_tab()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.pos_tabs_recompute_total(NEW.tab_id);
  RETURN NEW;
END $function$;

CREATE TRIGGER trg_pos_orders_recompute_tab
AFTER INSERT OR UPDATE ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.pos_orders_after_change_recompute_tab();

-- 6. pos_tabs guard
CREATE OR REPLACE FUNCTION public.pos_tabs_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_internal text;
  v_split jsonb;
  v_sum bigint;
BEGIN
  v_internal := current_setting('pos.internal', true);

  IF TG_OP = 'UPDATE' THEN
    IF NEW.casino_id IS DISTINCT FROM OLD.casino_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.opened_by_user_id IS DISTINCT FROM OLD.opened_by_user_id
       OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'pos_tabs: identity fields are immutable.';
    END IF;

    IF OLD.status IN ('closed','voided') AND NEW.status = 'open' THEN
      RAISE EXCEPTION 'pos_tabs: cannot reopen a closed or voided tab.';
    END IF;

    IF OLD.status = 'open' AND NEW.status = 'closed' THEN
      v_split := NEW.payment_split;
      IF v_split IS NULL THEN
        RAISE EXCEPTION 'pos_tabs: payment_split required on close.';
      END IF;
      v_sum := COALESCE((v_split->>'cash')::bigint,0)
             + COALESCE((v_split->>'card')::bigint,0)
             + COALESCE((v_split->>'comp_player')::bigint,0)
             + COALESCE((v_split->>'comp_house')::bigint,0);
      IF v_sum <> NEW.total_tzs THEN
        RAISE EXCEPTION 'pos_tabs: payment_split sum (%) must equal total_tzs (%).', v_sum, NEW.total_tzs;
      END IF;
      IF COALESCE((v_split->>'comp_player')::bigint,0) > 0 AND NEW.player_id IS NULL THEN
        RAISE EXCEPTION 'pos_tabs: comp_player requires a player on the tab.';
      END IF;
      IF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
      IF NEW.closed_by_user_id IS NULL THEN NEW.closed_by_user_id := auth.uid(); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER trg_pos_tabs_guard
BEFORE UPDATE ON public.pos_tabs
FOR EACH ROW EXECUTE FUNCTION public.pos_tabs_guard();

-- 7. pos_tabs business_date on insert
CREATE OR REPLACE FUNCTION public.pos_tabs_set_business_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.business_date IS NULL THEN
    BEGIN
      NEW.business_date := public.get_current_business_date(NEW.casino_id);
    EXCEPTION WHEN OTHERS THEN
      NEW.business_date := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
    END;
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER trg_pos_tabs_set_business_date
BEFORE INSERT ON public.pos_tabs
FOR EACH ROW EXECUTE FUNCTION public.pos_tabs_set_business_date();

-- 8. Comp → expense bridge on close
CREATE OR REPLACE FUNCTION public.pos_tabs_after_close_comp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comp_p bigint;
  v_comp_h bigint;
  v_total_comp bigint;
  v_expense_id uuid;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    v_comp_p := COALESCE((NEW.payment_split->>'comp_player')::bigint,0);
    v_comp_h := COALESCE((NEW.payment_split->>'comp_house')::bigint,0);
    v_total_comp := v_comp_p + v_comp_h;
    IF v_total_comp > 0 THEN
      INSERT INTO public.expenses (
        casino_id, category, amount, description, player_id, player_name,
        approved, created_by, business_date, cage_type
      ) VALUES (
        NEW.casino_id,
        'pos_comp'::expense_category,
        v_total_comp,
        'POS Comp · Tab #' || substr(NEW.id::text,1,8)
          || CASE WHEN v_comp_p > 0 AND v_comp_h > 0
                  THEN ' · player ' || v_comp_p || ' + house ' || v_comp_h
                  WHEN v_comp_p > 0 THEN ' · player'
                  ELSE ' · house' END,
        CASE WHEN v_comp_p > 0 THEN NEW.player_id ELSE NULL END,
        COALESCE(NEW.player_name, ''),
        true,
        COALESCE(NEW.closed_by_user_id, auth.uid()),
        NEW.business_date,
        'live'
      ) RETURNING id INTO v_expense_id;

      PERFORM set_config('pos.internal','on', true);
      UPDATE public.pos_tabs SET expense_id = v_expense_id WHERE id = NEW.id;
      PERFORM set_config('pos.internal','', true);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER trg_pos_tabs_after_close_comp
AFTER UPDATE ON public.pos_tabs
FOR EACH ROW EXECUTE FUNCTION public.pos_tabs_after_close_comp();

-- 9. Realtime publication
ALTER TABLE public.pos_tabs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_tabs;
