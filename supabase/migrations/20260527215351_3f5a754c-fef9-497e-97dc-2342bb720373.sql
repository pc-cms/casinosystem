
CREATE OR REPLACE FUNCTION public.compute_slots_shift_balance_from_row(s public.cage_slots_shifts)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_cash_tzs bigint := 0;
  v_closing_cash_tzs bigint := 0;
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
  v_system_result    bigint := 0;
  v_slots_result     bigint := 0;
  v_expected         bigint := 0;
  v_counted          bigint := 0;
  v_difference       bigint := 0;
  v_balance          bigint := 0;
  v_closing_seed     jsonb;
  v_usd_rate         numeric := 0;
BEGIN
  SELECT COALESCE(rate_to_tzs, 0) INTO v_usd_rate
    FROM public.cage_slots_exchange_rates
   WHERE cage_slots_shift_id = s.id AND currency_code = 'USD'
   LIMIT 1;

  SELECT COALESCE(SUM(total_tzs), 0)::bigint
    INTO v_opening_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'opening';

  SELECT COALESCE(SUM(total_tzs), 0)::bigint
    INTO v_closing_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'closing';

  SELECT denominations INTO v_closing_seed
    FROM public.cage_slots_cash_counts
   WHERE cage_slots_shift_id = s.id
     AND COALESCE((denominations->>'is_opening')::boolean, false) IS FALSE
   ORDER BY COALESCE((denominations->>'is_closing')::boolean, false) DESC, created_at DESC
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

  SELECT COALESCE(SUM(amount), 0)::bigint
    INTO v_expenses
    FROM public.expenses
   WHERE cage_slots_shift_id = s.id AND approved = true;

  SELECT
    COALESCE(SUM(CASE WHEN transfer_type = 'fill'       THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'collection' THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_in'      THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_out'     THEN amount END), 0)::bigint
  INTO v_add_float, v_collection, v_lg_in, v_lg_out
  FROM public.cage_slots_transfers
  WHERE cage_slots_shift_id = s.id;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'IN'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount END), 0)::bigint
  INTO v_cashless_in, v_cashless_out
  FROM public.cashless_transactions
  WHERE cage_slots_shift_id = s.id;

  SELECT
    COALESCE(opening_card_count, 0),
    COALESCE(closing_card_count, 0),
    COALESCE(card_deposit_value_tzs, 0)
  INTO v_open_cards, v_close_cards, v_card_value
  FROM public.cage_slots_cards
  WHERE cage_slots_shift_id = s.id;

  v_cards_miss    := (v_open_cards - v_close_cards)::bigint * v_card_value;
  v_system_result := COALESCE(s.system_shift_result, 0)::bigint;
  -- Derived Slots Result (P&L) — may be negative, this is normal.
  v_slots_result  := v_system_result - v_opening_cash_tzs - v_add_float;

  -- Expected against the raw system readout (not opening + system).
  v_expected   := v_system_result;
  v_counted    := v_closing_cash_tzs
                + v_expenses
                + v_collection
                - v_add_float
                + v_lg_out - v_lg_in
                + v_cashless_out - v_cashless_in;
  v_difference := v_counted - v_expected;
  v_balance    := v_difference - v_cards_miss;
  -- Equivalent: v_balance = v_counted - v_system_result - v_cards_miss
  --          = cash_desk_result - slots_result_derived - cards_miss  (after algebra)

  RETURN jsonb_build_object(
    'opening_cash',         v_opening_cash_tzs,
    'closing_cash',         v_closing_cash_tzs,
    'expenses',             v_expenses,
    'collection',           v_collection,
    'add_float',            v_add_float,
    'lg_in',                v_lg_in,
    'lg_out',               v_lg_out,
    'cashless_in',          v_cashless_in,
    'cashless_out',         v_cashless_out,
    'cards_miss',           v_cards_miss,
    'system_result',        v_system_result,
    'slots_result',         v_slots_result,
    'slots_result_derived', v_slots_result,
    'expected',             v_expected,
    'counted',              v_counted,
    'difference',           v_difference,
    'cash_desk_result',     v_counted,
    'balance',              v_balance
  );
END;
$$;

-- Recompute existing shifts so persisted slots_result / balance match the new formula.
DO $$
DECLARE
  r public.cage_slots_shifts%ROWTYPE;
  j jsonb;
BEGIN
  FOR r IN SELECT * FROM public.cage_slots_shifts LOOP
    j := public.compute_slots_shift_balance_from_row(r);
    UPDATE public.cage_slots_shifts
       SET slots_result   = (j->>'slots_result')::bigint,
           balance        = (j->>'balance')::bigint,
           cash_desk_result   = (j->>'cash_desk_result')::bigint,
           cards_miss     = (j->>'cards_miss')::bigint,
           actual_cage_result = (j->>'counted')::bigint,
           difference_amount  = (j->>'difference')::bigint
     WHERE id = r.id;
  END LOOP;
END $$;
