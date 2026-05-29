-- 1) POS shift_type: drop 'evening', keep only 'day' & 'night'
UPDATE public.pos_shifts SET shift_type = 'night' WHERE shift_type = 'evening';

ALTER TABLE public.pos_shifts
  DROP CONSTRAINT IF EXISTS pos_shifts_shift_type_chk;
ALTER TABLE public.pos_shifts
  ADD CONSTRAINT pos_shifts_shift_type_chk
  CHECK (shift_type IN ('day','night'));

-- 2) Update pos_handover_shift to accept only day/night
CREATE OR REPLACE FUNCTION public.pos_handover_shift(
  _closing_shift_id uuid,
  _new_waiter_user_id uuid,
  _new_shift_type text,
  _closing_cash bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_outgoing pos_shifts%ROWTYPE;
  v_new_id uuid;
  v_z jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _new_shift_type NOT IN ('day','night') THEN
    RAISE EXCEPTION 'invalid shift_type %', _new_shift_type;
  END IF;

  SELECT * INTO v_outgoing FROM pos_shifts WHERE id = _closing_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shift not found'; END IF;
  IF v_outgoing.closed_at IS NOT NULL THEN RAISE EXCEPTION 'shift already closed'; END IF;

  IF EXISTS (SELECT 1 FROM pos_tabs t WHERE t.shift_id = _closing_shift_id AND t.status = 'open') THEN
    RAISE EXCEPTION 'open tabs exist on outgoing shift';
  END IF;

  v_z := public.pos_close_shift(_closing_shift_id, _closing_cash);

  INSERT INTO pos_shifts (
    casino_id, waiter_user_id, opening_cash, shift_type, handover_from_shift_id
  ) VALUES (
    v_outgoing.casino_id, _new_waiter_user_id, _closing_cash, _new_shift_type, v_outgoing.id
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'closed_shift_id', _closing_shift_id,
    'new_shift_id',    v_new_id,
    'z_report',        v_z
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_handover_shift(uuid, uuid, text, bigint) TO authenticated;

-- 3) Extend business day snapshot with pos_shifts, pos_stock_counts and bar_totals.
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

  -- NEW (M12): POS bar shifts closed on this business day
  result := jsonb_set(result, '{pos_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'shift_type', p.shift_type,
      'opened_at', p.opened_at,
      'closed_at', p.closed_at,
      'opening_cash', p.opening_cash,
      'closing_cash', p.closing_cash,
      'waiter_user_id', p.waiter_user_id,
      'z_report', p.z_report
    ) ORDER BY p.opened_at)
    FROM pos_shifts p
    WHERE p.casino_id = _casino_id
      AND p.closed_at IS NOT NULL
      AND p.business_date = _business_date
  ), '[]'::jsonb));

  -- NEW (M12): POS stock counts performed on this business day
  result := jsonb_set(result, '{pos_stock_counts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sc.id,
      'count_type', sc.count_type,
      'counted_by', sc.counted_by,
      'counted_by_name', sc.counted_by_name,
      'items_count', sc.items_count,
      'total_variance_value_tzs', sc.total_variance_value_tzs,
      'created_at', sc.created_at,
      'shift_id', sc.shift_id
    ) ORDER BY sc.created_at)
    FROM pos_stock_counts sc
    JOIN pos_shifts ps ON ps.id = sc.shift_id
    WHERE sc.casino_id = _casino_id
      AND ps.business_date = _business_date
  ), '[]'::jsonb));

  -- Aggregate live + slots
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

  -- NEW (M12): bar totals from closed POS shifts' z_report
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

  -- Player charges from pos_tabs settled this business day (charge = on player tab not paid cash/card)
  SELECT COALESCE(SUM(GREATEST(t.gross_tzs - COALESCE(t.cash_tzs,0) - COALESCE(t.card_tzs,0) - COALESCE(t.comp_house_tzs,0) - COALESCE(t.comp_player_tzs,0), 0)), 0)
  INTO v_bar_charge
  FROM pos_tabs t
  JOIN pos_shifts p ON p.id = t.shift_id
  WHERE t.casino_id = _casino_id
    AND t.status = 'closed'
    AND p.business_date = _business_date;

  v_net := v_tables + v_slots - v_chip_miss - v_cards_miss - v_expenses_total;

  result := jsonb_set(result, '{daily_result}', jsonb_build_object(
    'tables_total',     v_tables,
    'slots_total',      v_slots,
    'chip_miss_total',  v_chip_miss,
    'cards_miss_total', v_cards_miss,
    'expenses_total',   v_expenses_total,
    'net_result',       v_net
  ));

  result := jsonb_set(result, '{bar_totals}', jsonb_build_object(
    'gross_tzs',     v_bar_gross,
    'cash_tzs',      v_bar_cash,
    'card_tzs',      v_bar_card,
    'comp_house_tzs', v_bar_comp_house,
    'comp_player_tzs', v_bar_comp_player,
    'player_charge_tzs', v_bar_charge,
    'bills_count',   v_bar_bills
  ));

  RETURN result;
END;
$$;