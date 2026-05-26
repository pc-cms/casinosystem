
-- ============================================================
-- Cage Slots: canonical balance fields + computation trigger
-- + business day snapshot extension with aggregated daily result
-- ============================================================

-- 1) New canonical columns on cage_slots_shifts
ALTER TABLE public.cage_slots_shifts
  ADD COLUMN IF NOT EXISTS cash_desk_result bigint,
  ADD COLUMN IF NOT EXISTS cards_miss       bigint,
  ADD COLUMN IF NOT EXISTS slots_result     bigint,
  ADD COLUMN IF NOT EXISTS balance          bigint;

COMMENT ON COLUMN public.cage_slots_shifts.cash_desk_result IS
  'Canonical Cash Desk Result: ΔCash + Expenses + Collection − AddFloat + LG_Out − LG_In + CashlessOut − CashlessIn (no Miss, no Cards). Computed by trigger.';
COMMENT ON COLUMN public.cage_slots_shifts.cards_miss IS
  'Cards Miss: (OpeningCards − ClosingCards) × CardValue. Minus = shortage. Computed by trigger.';
COMMENT ON COLUMN public.cage_slots_shifts.slots_result IS
  'Canonical Slots Result mirrors system_shift_result (what slot system reported). Computed by trigger.';
COMMENT ON COLUMN public.cage_slots_shifts.balance IS
  'Shift Balance = Cash Desk Result − Slots Result − Cards Miss. 0 = perfect.';

-- 2) Computation function (mirrors compute_shift_balance_from_row for live)
CREATE OR REPLACE FUNCTION public.compute_slots_shift_balance_from_row(s public.cage_slots_shifts)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_cash_tzs bigint := 0;
  v_closing_cash_tzs bigint := 0;
  v_delta_cash       bigint := 0;
  v_expenses         bigint := 0;
  v_add_float        bigint := 0;
  v_collection       bigint := 0;
  v_lg_in            bigint := 0;
  v_lg_out           bigint := 0;
  v_cashless_in      bigint := 0;
  v_cashless_out     bigint := 0;
  v_open_cards       int    := 0;
  v_close_cards      int    := 0;
  v_card_value       bigint := 0;
  v_cards_miss       bigint := 0;
  v_slots_result     bigint := 0;
  v_cash_desk        bigint := 0;
  v_balance          bigint := 0;
  v_opening_seed     jsonb;
  v_closing_seed     jsonb;
  v_usd_rate         numeric := 0;
BEGIN
  -- USD rate (for bank.usd → TZS)
  SELECT COALESCE(rate_to_tzs, 0) INTO v_usd_rate
    FROM public.cage_slots_exchange_rates
   WHERE cage_slots_shift_id = s.id AND currency_code = 'USD'
   LIMIT 1;

  -- Opening cash from inventory (already in TZS, includes all currencies)
  SELECT COALESCE(SUM(total_tzs), 0)::bigint
    INTO v_opening_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'opening';

  -- Opening seed snapshot — banks/mobile carry-over
  SELECT denominations INTO v_opening_seed
    FROM public.cage_slots_cash_counts
   WHERE cage_slots_shift_id = s.id
     AND (denominations->>'is_opening')::boolean IS TRUE
   ORDER BY created_at ASC
   LIMIT 1;
  IF v_opening_seed IS NOT NULL THEN
    v_opening_cash_tzs := v_opening_cash_tzs
      + COALESCE((v_opening_seed->'bank'->>'tzs')::bigint, 0)
      + COALESCE(((v_opening_seed->'bank'->>'usd')::numeric * v_usd_rate)::bigint, 0)
      + COALESCE((
          SELECT SUM((value)::bigint)
          FROM jsonb_each_text(COALESCE(v_opening_seed->'mobile', '{}'::jsonb))
        ), 0);
  END IF;

  -- Closing cash from inventory
  SELECT COALESCE(SUM(total_tzs), 0)::bigint
    INTO v_closing_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'closing';

  -- Latest closing snapshot — banks/mobile at close
  SELECT denominations INTO v_closing_seed
    FROM public.cage_slots_cash_counts
   WHERE cage_slots_shift_id = s.id
     AND (denominations->>'is_closing')::boolean IS TRUE
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_closing_seed IS NOT NULL THEN
    v_closing_cash_tzs := v_closing_cash_tzs
      + COALESCE((v_closing_seed->'bank'->>'tzs')::bigint, 0)
      + COALESCE(((v_closing_seed->'bank'->>'usd')::numeric * v_usd_rate)::bigint, 0)
      + COALESCE((
          SELECT SUM((value)::bigint)
          FROM jsonb_each_text(COALESCE(v_closing_seed->'mobile', '{}'::jsonb))
        ), 0);
  END IF;

  v_delta_cash := v_closing_cash_tzs - v_opening_cash_tzs;

  -- Expenses approved for this slots shift
  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses
    FROM public.expenses
   WHERE cage_slots_shift_id = s.id AND approved = true;

  -- Transfers
  SELECT
    COALESCE(SUM(CASE WHEN transfer_type = 'add_float'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'collection' THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_in'      THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_out'     THEN amount END), 0)::bigint
  INTO v_add_float, v_collection, v_lg_in, v_lg_out
  FROM public.cage_slots_transfers
  WHERE cage_slots_shift_id = s.id;

  -- Cashless
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'IN'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount END), 0)::bigint
  INTO v_cashless_in, v_cashless_out
  FROM public.cashless_transactions
  WHERE cage_slots_shift_id = s.id;

  -- Cards Miss
  SELECT
    COALESCE(opening_card_count, 0),
    COALESCE(closing_card_count, 0),
    COALESCE(card_deposit_value_tzs, 0)
  INTO v_open_cards, v_close_cards, v_card_value
  FROM public.cage_slots_cards
  WHERE cage_slots_shift_id = s.id;

  v_cards_miss := (v_open_cards - v_close_cards)::bigint * v_card_value;

  v_slots_result := COALESCE(s.system_shift_result, 0)::bigint;

  v_cash_desk := v_delta_cash
               + v_expenses
               + v_collection
               - v_add_float
               + v_lg_out - v_lg_in
               + v_cashless_out - v_cashless_in;

  v_balance := v_cash_desk - v_slots_result - v_cards_miss;

  RETURN jsonb_build_object(
    'opening_cash',     v_opening_cash_tzs,
    'closing_cash',     v_closing_cash_tzs,
    'delta_cash',       v_delta_cash,
    'expenses',         v_expenses,
    'collection',       v_collection,
    'add_float',        v_add_float,
    'lg_in',            v_lg_in,
    'lg_out',           v_lg_out,
    'cashless_in',      v_cashless_in,
    'cashless_out',     v_cashless_out,
    'cards_miss',       v_cards_miss,
    'slots_result',     v_slots_result,
    'cash_desk_result', v_cash_desk,
    'balance',          v_balance
  );
END;
$$;

-- Convenience wrapper by id
CREATE OR REPLACE FUNCTION public.compute_slots_shift_balance(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.cage_slots_shifts%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.cage_slots_shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'shift_not_found');
  END IF;
  RETURN public.compute_slots_shift_balance_from_row(r);
END;
$$;

-- 3) Persist computed fields on shift row when status moves to ready_for_review / closed / approved
CREATE OR REPLACE FUNCTION public.trg_persist_slots_shift_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE j jsonb;
BEGIN
  -- Recompute when status enters a settled lifecycle stage or when system_shift_result changes
  IF (TG_OP = 'INSERT')
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.system_shift_result IS DISTINCT FROM OLD.system_shift_result THEN

    IF NEW.status IN ('ready_for_review', 'approved', 'closed') THEN
      j := public.compute_slots_shift_balance_from_row(NEW);
      NEW.cash_desk_result := (j->>'cash_desk_result')::bigint;
      NEW.cards_miss       := (j->>'cards_miss')::bigint;
      NEW.slots_result     := (j->>'slots_result')::bigint;
      NEW.balance          := (j->>'balance')::bigint;
      -- Keep legacy mirrors populated for any consumers still reading them
      NEW.actual_cage_result := NEW.cash_desk_result;
      NEW.difference_amount  := NEW.balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_persist_slots_shift_balance ON public.cage_slots_shifts;
CREATE TRIGGER trg_persist_slots_shift_balance
  BEFORE INSERT OR UPDATE ON public.cage_slots_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_persist_slots_shift_balance();

-- 4) Extend business day snapshot with aggregated daily result
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
BEGIN
  -- existing sections
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

  -- NEW: live shifts that belong to this business day (closed only)
  result := jsonb_set(result, '{live_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'opened_at', s.opened_at,
      'closed_at', s.closed_at,
      'tables_result', s.tables_result,
      'miss_total', s.miss_total,
      'cash_desk_result', s.cash_desk_result,
      'balance', s.balance,
      'cashier_id', s.opened_by
    ) ORDER BY s.opened_at)
    FROM shifts s
    WHERE s.casino_id = _casino_id
      AND s.status = 'closed'
      AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
            - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
          ) = _business_date
  ), '[]'::jsonb));

  -- NEW: slots shifts for this business day (closed only)
  result := jsonb_set(result, '{slots_shifts}', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', cs.id,
      'shift_type', cs.shift_type,
      'opened_at', cs.opened_at,
      'closed_at', cs.closed_at,
      'system_shift_result', cs.system_shift_result,
      'slots_result', cs.slots_result,
      'cards_miss', cs.cards_miss,
      'cash_desk_result', cs.cash_desk_result,
      'balance', cs.balance,
      'cashier_id', cs.cashier_id
    ) ORDER BY cs.opened_at)
    FROM cage_slots_shifts cs
    WHERE cs.casino_id = _casino_id
      AND cs.status = 'closed'
      AND cs.business_date = _business_date
  ), '[]'::jsonb));

  -- NEW: aggregated daily result
  -- Tables + Slots − ChipMiss − CardsMiss − Expenses
  -- (Collections, AddFloat, LG↔Slots transfers are internal movements — excluded.)
  SELECT COALESCE(SUM(s.tables_result), 0)::bigint,
         COALESCE(SUM(s.miss_total), 0)::bigint
    INTO v_tables, v_chip_miss
    FROM shifts s
   WHERE s.casino_id = _casino_id
     AND s.status = 'closed'
     AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
           - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
         ) = _business_date;

  SELECT COALESCE(SUM(slots_result), 0)::bigint,
         COALESCE(SUM(cards_miss), 0)::bigint
    INTO v_slots, v_cards_miss
    FROM cage_slots_shifts
   WHERE casino_id = _casino_id
     AND status = 'closed'
     AND business_date = _business_date;

  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses_total
    FROM expenses e
   WHERE e.casino_id = _casino_id
     AND e.approved = true
     AND COALESCE(e.business_date, e.created_at::date) = _business_date;

  v_net := v_tables + v_slots - v_chip_miss - v_cards_miss - v_expenses_total;

  result := jsonb_set(result, '{daily_result}', jsonb_build_object(
    'tables_total',     v_tables,
    'slots_total',      v_slots,
    'chip_miss_total',  v_chip_miss,
    'cards_miss_total', v_cards_miss,
    'expenses_total',   v_expenses_total,
    'net_result',       v_net
  ));

  RETURN result;
END;
$$;

-- 5) Backfill existing closed slots shifts so balance fields are populated
DO $$
DECLARE r record; j jsonb;
BEGIN
  FOR r IN
    SELECT * FROM public.cage_slots_shifts
    WHERE status IN ('closed','approved','ready_for_review')
      AND (cash_desk_result IS NULL OR balance IS NULL OR slots_result IS NULL)
  LOOP
    j := public.compute_slots_shift_balance_from_row(r);
    UPDATE public.cage_slots_shifts
       SET cash_desk_result = (j->>'cash_desk_result')::bigint,
           cards_miss       = (j->>'cards_miss')::bigint,
           slots_result     = (j->>'slots_result')::bigint,
           balance          = (j->>'balance')::bigint,
           actual_cage_result = (j->>'cash_desk_result')::bigint,
           difference_amount  = (j->>'balance')::bigint
     WHERE id = r.id;
  END LOOP;
END$$;
