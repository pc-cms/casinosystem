-- Unify business-day rollover to 07:00 EAT (was inconsistent: 5/11/13).
-- Manual closures recorded in business_day_closures still take precedence
-- for "current business day" via get_current_business_date().

-- 1) business_date_of: shift -7h instead of -5h
CREATE OR REPLACE FUNCTION public.business_date_of(_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT (((_ts AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '7 hours'))::date;
$$;

-- 2) get_current_business_date: fallback hour 11 -> 7
CREATE OR REPLACE FUNCTION public.get_current_business_date(_casino_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _last_closed date;
  _now_eat timestamp;
  _eat_hour int;
  _today date;
BEGIN
  SELECT MAX(business_date) INTO _last_closed
  FROM public.business_day_closures
  WHERE casino_id = _casino_id;

  _now_eat := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _eat_hour := EXTRACT(HOUR FROM _now_eat)::int;
  _today := _now_eat::date;

  IF _last_closed IS NOT NULL THEN
    RETURN LEAST(_last_closed + 1, _today);
  END IF;

  IF _eat_hour < 7 THEN
    RETURN _today - 1;
  END IF;
  RETURN _today;
END;
$$;

-- 3) build_business_day_snapshot: replace inline "< 5" with business_date_of(opened_at) = _business_date
CREATE OR REPLACE FUNCTION public.build_business_day_snapshot(_casino_id uuid, _business_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        (s.opened_at IS NOT NULL AND public.business_date_of(s.opened_at) = _business_date)
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
      AND public.business_date_of(s.opened_at) = _business_date
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
     AND public.business_date_of(s.opened_at) = _business_date;

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
$function$;
