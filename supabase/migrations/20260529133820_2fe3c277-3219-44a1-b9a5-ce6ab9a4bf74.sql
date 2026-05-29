
ALTER TYPE public.wallet_type     ADD VALUE IF NOT EXISTS 'bar_cash';
ALTER TYPE public.wallet_tx_type  ADD VALUE IF NOT EXISTS 'pos_deposit';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'bar_charge';

COMMIT;
BEGIN;

-- 2) Backfill BAR_CASH wallet for every casino
INSERT INTO public.financial_wallets (casino_id, wallet_type, current_balance)
SELECT c.id, 'bar_cash'::public.wallet_type, 0
FROM public.casinos c
ON CONFLICT (casino_id, wallet_type) DO NOTHING;

-- 3) Comp budget table
CREATE TABLE IF NOT EXISTS public.pos_comp_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  month_start date NOT NULL,
  limit_tzs bigint NOT NULL CHECK (limit_tzs >= 0),
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, month_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_comp_budgets TO authenticated;
GRANT ALL ON public.pos_comp_budgets TO service_role;

ALTER TABLE public.pos_comp_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcb_select" ON public.pos_comp_budgets FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_can_see_casino(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'pos_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
);

CREATE POLICY "pcb_write" ON public.pos_comp_budgets FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_see_casino(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "pcb_update" ON public.pos_comp_budgets FOR UPDATE TO authenticated
USING (
  public.user_can_see_casino(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "pcb_delete" ON public.pos_comp_budgets FOR DELETE TO authenticated
USING (
  public.user_can_see_casino(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE OR REPLACE FUNCTION public.touch_pos_comp_budgets()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_pos_comp_budgets ON public.pos_comp_budgets;
CREATE TRIGGER trg_touch_pos_comp_budgets
BEFORE UPDATE ON public.pos_comp_budgets
FOR EACH ROW EXECUTE FUNCTION public.touch_pos_comp_budgets();

-- 4) RPC comp budget status
CREATE OR REPLACE FUNCTION public.pos_comp_budget_status(_casino_id uuid, _month_start date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := COALESCE(_month_start, date_trunc('month', (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date)::date);
  v_next  date := (v_month + INTERVAL '1 month')::date;
  v_limit bigint := 0;
  v_house bigint := 0;
  v_player bigint := 0;
BEGIN
  SELECT COALESCE(limit_tzs, 0) INTO v_limit
  FROM pos_comp_budgets
  WHERE casino_id = _casino_id AND month_start = v_month;

  SELECT
    COALESCE(SUM(COALESCE((t.payment_split->>'comp_house')::bigint, 0)), 0),
    COALESCE(SUM(COALESCE((t.payment_split->>'comp_player')::bigint, 0)), 0)
  INTO v_house, v_player
  FROM pos_tabs t
  WHERE t.casino_id = _casino_id
    AND t.status = 'closed'
    AND t.business_date >= v_month
    AND t.business_date <  v_next;

  RETURN jsonb_build_object(
    'month_start', v_month,
    'limit_tzs',   v_limit,
    'used_house_tzs',  v_house,
    'used_player_tzs', v_player,
    'remaining_tzs',   GREATEST(v_limit - v_house, 0),
    'percent_used',    CASE WHEN v_limit > 0 THEN ROUND(v_house::numeric * 100.0 / v_limit, 2) ELSE NULL END,
    'is_over',         (v_limit > 0 AND v_house > v_limit)
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.pos_comp_budget_status(uuid, date) TO authenticated;

-- 5) Extend pos_tabs after-close to also emit a BAR_CHARGE expense
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
  v_charge bigint;
  v_expense_id uuid;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    v_comp_p := COALESCE((NEW.payment_split->>'comp_player')::bigint,0);
    v_comp_h := COALESCE((NEW.payment_split->>'comp_house')::bigint,0);
    v_charge := COALESCE((NEW.payment_split->>'player_charge')::bigint,0);
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

    IF v_charge > 0 AND NEW.player_id IS NOT NULL THEN
      INSERT INTO public.expenses (
        casino_id, category, amount, description, player_id, player_name,
        approved, created_by, business_date, cage_type
      ) VALUES (
        NEW.casino_id,
        'bar_charge'::expense_category,
        v_charge,
        'Bar Charge · Tab #' || substr(NEW.id::text,1,8),
        NEW.player_id,
        COALESCE(NEW.player_name, ''),
        true,
        COALESCE(NEW.closed_by_user_id, auth.uid()),
        NEW.business_date,
        'live'
      );
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 6) Auto-post POS shift closing cash delta into BAR_CASH wallet ledger
CREATE OR REPLACE FUNCTION public.pos_shifts_after_close_to_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta bigint;
BEGIN
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
    v_delta := COALESCE(NEW.closing_cash, 0) - COALESCE(NEW.opening_cash, 0);
    IF v_delta <> 0 THEN
      INSERT INTO public.wallet_transactions (
        casino_id, tx_type, from_wallet, to_wallet, amount, description, operator_id
      ) VALUES (
        NEW.casino_id,
        'pos_deposit'::wallet_tx_type,
        NULL,
        'bar_cash'::wallet_type,
        v_delta,
        'POS shift #' || substr(NEW.id::text,1,8) || ' close · '
          || COALESCE(NEW.shift_type,'') || ' · Δ cash ' || v_delta,
        COALESCE(NEW.waiter_user_id, auth.uid())
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pos_shifts_after_close_to_wallet ON public.pos_shifts;
CREATE TRIGGER trg_pos_shifts_after_close_to_wallet
AFTER UPDATE ON public.pos_shifts
FOR EACH ROW EXECUTE FUNCTION public.pos_shifts_after_close_to_wallet();

-- 7) Rewrite snapshot — fix payment_split refs + add COGS + bar_pl into Net
CREATE OR REPLACE FUNCTION public.build_business_day_snapshot(_casino_id uuid, _business_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  v_tables          bigint := 0;
  v_slots           bigint := 0;
  v_chip_miss       bigint := 0;
  v_cards_miss      bigint := 0;
  v_expenses_total  bigint := 0;
  v_net             bigint := 0;
  v_bar_gross       bigint := 0;
  v_bar_cash        bigint := 0;
  v_bar_card        bigint := 0;
  v_bar_comp_house  bigint := 0;
  v_bar_comp_player bigint := 0;
  v_bar_charge      bigint := 0;
  v_bar_cogs        bigint := 0;
  v_bar_pl          bigint := 0;
  v_bar_bills       int := 0;
BEGIN
  result := jsonb_set(result, '{cash_counts}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cash_count_snapshots c
    WHERE c.casino_id = _casino_id AND c.created_at::date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{expenses}', COALESCE((
    SELECT jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at)
    FROM expenses e
    LEFT JOIN shifts s ON s.id = e.shift_id
    WHERE e.casino_id = _casino_id
      AND (
        (s.opened_at IS NOT NULL
          AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
               - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
              ) = _business_date)
        OR (s.id IS NULL AND COALESCE(e.business_date, e.created_at::date) = _business_date)
      )
  ), '[]'::jsonb));

  result := jsonb_set(result, '{cashless}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cashless_transactions c
    WHERE c.casino_id = _casino_id AND c.business_date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{table_tracker}', COALESCE((
    SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.time_slot)
    FROM table_tracker t WHERE t.casino_id = _casino_id AND t.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{chip_snapshots}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM chip_snapshots c WHERE c.casino_id = _casino_id AND c.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{breaklist}', COALESCE((
    SELECT jsonb_agg(to_jsonb(b.*) ORDER BY b.time_slot, b.employee_id)
    FROM breaklist b WHERE b.casino_id = _casino_id AND b.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{player_stats}', COALESCE((
    SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.started_at)
    FROM client_sessions s
    WHERE s.casino_id = _casino_id AND s.started_at::date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{live_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'opened_at', s.opened_at, 'closed_at', s.closed_at,
      'tables_result', s.tables_result, 'miss_total', s.miss_total,
      'cash_desk_result', s.cash_desk_result, 'balance', s.balance,
      'cashier_id', s.opened_by
    ) ORDER BY s.opened_at)
    FROM shifts s
    WHERE s.casino_id = _casino_id AND s.status = 'closed'
      AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
            - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
          ) = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{slots_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', cs.id, 'shift_type', cs.shift_type,
      'opened_at', cs.opened_at, 'closed_at', cs.closed_at,
      'system_shift_result', cs.system_shift_result, 'slots_result', cs.slots_result,
      'cards_miss', cs.cards_miss, 'cash_desk_result', cs.cash_desk_result,
      'balance', cs.balance, 'cashier_id', cs.cashier_id
    ) ORDER BY cs.opened_at)
    FROM cage_slots_shifts cs
    WHERE cs.casino_id = _casino_id AND cs.status = 'closed' AND cs.business_date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{pos_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'shift_type', p.shift_type,
      'opened_at', p.opened_at, 'closed_at', p.closed_at,
      'opening_cash', p.opening_cash, 'closing_cash', p.closing_cash,
      'waiter_user_id', p.waiter_user_id, 'z_report', p.z_report
    ) ORDER BY p.opened_at)
    FROM pos_shifts p
    WHERE p.casino_id = _casino_id
      AND p.closed_at IS NOT NULL
      AND p.business_date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{pos_stock_counts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sc.id, 'count_type', sc.count_type,
      'counted_by', sc.counted_by, 'counted_by_name', sc.counted_by_name,
      'items_count', sc.items_count, 'total_variance_value_tzs', sc.total_variance_value_tzs,
      'created_at', sc.created_at, 'shift_id', sc.shift_id
    ) ORDER BY sc.created_at)
    FROM pos_stock_counts sc
    JOIN pos_shifts ps ON ps.id = sc.shift_id
    WHERE sc.casino_id = _casino_id
      AND ps.business_date = _business_date
  ), '[]'::jsonb));

  SELECT COALESCE(SUM(s.tables_result), 0)::bigint,
         COALESCE(SUM(s.miss_total), 0)::bigint
    INTO v_tables, v_chip_miss
    FROM shifts s
   WHERE s.casino_id = _casino_id AND s.status = 'closed'
     AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
           - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
         ) = _business_date;

  SELECT COALESCE(SUM(slots_result), 0)::bigint,
         COALESCE(SUM(cards_miss), 0)::bigint
    INTO v_slots, v_cards_miss
    FROM cage_slots_shifts
   WHERE casino_id = _casino_id AND status = 'closed' AND business_date = _business_date;

  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses_total
    FROM expenses e
   WHERE e.casino_id = _casino_id AND e.approved = true
     AND COALESCE(e.business_date, e.created_at::date) = _business_date;

  SELECT
    COALESCE(SUM(((p.z_report->'totals')->>'gross_tzs')::bigint), 0),
    COALESCE(SUM(((p.z_report->'totals')->>'cash')::bigint), 0),
    COALESCE(SUM(((p.z_report->'totals')->>'card')::bigint), 0),
    COALESCE(SUM(((p.z_report->'totals')->>'comp_house')::bigint), 0),
    COALESCE(SUM(((p.z_report->'totals')->>'comp_player')::bigint), 0),
    COALESCE(SUM(((p.z_report->'counts')->>'tabs_closed')::int), 0)
  INTO v_bar_gross, v_bar_cash, v_bar_card, v_bar_comp_house, v_bar_comp_player, v_bar_bills
  FROM pos_shifts p
  WHERE p.casino_id = _casino_id
    AND p.closed_at IS NOT NULL
    AND p.business_date = _business_date
    AND p.z_report IS NOT NULL;

  SELECT COALESCE(SUM(COALESCE((t.payment_split->>'player_charge')::bigint, 0)), 0)
  INTO v_bar_charge
  FROM pos_tabs t
  WHERE t.casino_id = _casino_id
    AND t.status = 'closed'
    AND t.business_date = _business_date;

  SELECT COALESCE(SUM(oi.qty * COALESCE(mi.avg_cost_tzs, 0)), 0)::bigint
  INTO v_bar_cogs
  FROM pos_order_items oi
  JOIN pos_orders o ON o.id = oi.order_id
  JOIN pos_tabs t   ON t.id = o.tab_id
  LEFT JOIN pos_menu_items mi ON mi.id = oi.item_id
  WHERE t.casino_id = _casino_id
    AND t.status = 'closed'
    AND t.business_date = _business_date;

  v_bar_pl := v_bar_gross - v_bar_cogs;

  v_net := v_tables + v_slots - v_chip_miss - v_cards_miss - v_expenses_total + v_bar_pl;

  result := jsonb_set(result, '{daily_result}', jsonb_build_object(
    'tables_total',     v_tables,
    'slots_total',      v_slots,
    'chip_miss_total',  v_chip_miss,
    'cards_miss_total', v_cards_miss,
    'expenses_total',   v_expenses_total,
    'bar_pl',           v_bar_pl,
    'net_result',       v_net
  ));

  result := jsonb_set(result, '{bar_totals}', jsonb_build_object(
    'gross_tzs',         v_bar_gross,
    'cash_tzs',          v_bar_cash,
    'card_tzs',          v_bar_card,
    'comp_house_tzs',    v_bar_comp_house,
    'comp_player_tzs',   v_bar_comp_player,
    'player_charge_tzs', v_bar_charge,
    'cogs_tzs',          v_bar_cogs,
    'pl_tzs',            v_bar_pl,
    'bills_count',       v_bar_bills
  ));

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_business_day_snapshot(uuid, date) TO authenticated;
