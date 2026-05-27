-- Cage Slots balance formula fix:
-- Expected = opening balance + system result
-- Count = physical counted cash/bank/mobile + approved expenses + collections - fills
--       + LG out - LG in + cashless out - cashless in
-- Difference = Count - Expected
-- Balance = Difference - Cards Miss

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

  -- Opening balance is the manual opening inventory only.
  SELECT COALESCE(SUM(total_tzs), 0)::bigint
    INTO v_opening_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'opening';

  -- Current counted cash from inventory plus latest check's bank/mobile balances.
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

  v_cards_miss := (v_open_cards - v_close_cards)::bigint * v_card_value;
  v_slots_result := COALESCE(s.system_shift_result, 0)::bigint;
  v_expected := v_opening_cash_tzs + v_slots_result;
  v_counted := v_closing_cash_tzs
             + v_expenses
             + v_collection
             - v_add_float
             + v_lg_out - v_lg_in
             + v_cashless_out - v_cashless_in;
  v_difference := v_counted - v_expected;
  v_balance := v_difference - v_cards_miss;

  RETURN jsonb_build_object(
    'opening_cash',     v_opening_cash_tzs,
    'closing_cash',     v_closing_cash_tzs,
    'expenses',         v_expenses,
    'collection',       v_collection,
    'add_float',        v_add_float,
    'lg_in',            v_lg_in,
    'lg_out',           v_lg_out,
    'cashless_in',      v_cashless_in,
    'cashless_out',     v_cashless_out,
    'cards_miss',       v_cards_miss,
    'slots_result',     v_slots_result,
    'expected',         v_expected,
    'counted',          v_counted,
    'difference',       v_difference,
    'cash_desk_result', v_counted,
    'balance',          v_balance
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.compute_cage_slots_balance(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.cage_slots_shifts%ROWTYPE;
  j jsonb;
BEGIN
  SELECT * INTO s FROM public.cage_slots_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'shift_not_found');
  END IF;

  j := public.compute_slots_shift_balance_from_row(s);

  RETURN j || jsonb_build_object(
    'opening_cash_total_tzs', (j->>'opening_cash')::bigint,
    'closing_cash_total_tzs', (j->>'closing_cash')::bigint,
    'expected_tzs',           (j->>'expected')::bigint,
    'counted_tzs',            (j->>'counted')::bigint,
    'actual_cage_result',     (j->>'counted')::bigint,
    'system_shift_result',    (j->>'slots_result')::bigint,
    'difference_amount',      (j->>'difference')::bigint,
    'balanced',               ((j->>'balance')::bigint = 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_persist_slots_shift_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE j jsonb;
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.system_shift_result IS DISTINCT FROM OLD.system_shift_result THEN

    IF NEW.status IN ('ready_for_review', 'approved', 'closed') THEN
      j := public.compute_slots_shift_balance_from_row(NEW);
      NEW.cash_desk_result   := (j->>'counted')::bigint;
      NEW.cards_miss         := (j->>'cards_miss')::bigint;
      NEW.slots_result       := (j->>'slots_result')::bigint;
      NEW.balance            := (j->>'balance')::bigint;
      NEW.actual_cage_result := (j->>'counted')::bigint;
      NEW.difference_amount  := (j->>'difference')::bigint;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_cs_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    difference_amount  = (v_res->>'difference_amount')::bigint,
    cash_desk_result   = (v_res->>'counted')::bigint,
    cards_miss         = (v_res->>'cards_miss')::bigint,
    slots_result       = (v_res->>'slots_result')::bigint,
    balance            = (v_res->>'balance')::bigint
  WHERE id = v_shift_id;

  IF TG_TABLE_NAME = 'cage_slots_cards' THEN
    UPDATE public.cage_slots_cards SET
      miss_card_count = COALESCE(NEW.closing_card_count, 0) - COALESCE(NEW.opening_card_count, 0),
      card_balance_effect_tzs = (COALESCE(NEW.closing_card_count, 0) - COALESCE(NEW.opening_card_count, 0))::bigint * COALESCE(NEW.card_deposit_value_tzs, 0)
    WHERE cage_slots_shift_id = v_shift_id
      AND (miss_card_count IS DISTINCT FROM COALESCE(NEW.closing_card_count, 0) - COALESCE(NEW.opening_card_count, 0)
           OR card_balance_effect_tzs IS DISTINCT FROM (COALESCE(NEW.closing_card_count, 0) - COALESCE(NEW.opening_card_count, 0))::bigint * COALESCE(NEW.card_deposit_value_tzs, 0));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_cs_recompute_cashless()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_shift uuid; v_res jsonb;
BEGIN
  v_shift := COALESCE(NEW.cage_slots_shift_id, OLD.cage_slots_shift_id);
  IF v_shift IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  v_res := public.compute_cage_slots_balance(v_shift);
  UPDATE public.cage_slots_shifts SET
    actual_cage_result = (v_res->>'actual_cage_result')::bigint,
    difference_amount  = (v_res->>'difference_amount')::bigint,
    cash_desk_result   = (v_res->>'counted')::bigint,
    cards_miss         = (v_res->>'cards_miss')::bigint,
    slots_result       = (v_res->>'slots_result')::bigint,
    balance            = (v_res->>'balance')::bigint
  WHERE id = v_shift;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_cs_recompute_self()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_res jsonb;
BEGIN
  IF NEW.system_shift_result IS DISTINCT FROM OLD.system_shift_result THEN
    v_res := public.compute_cage_slots_balance(NEW.id);
    NEW.actual_cage_result := (v_res->>'actual_cage_result')::bigint;
    NEW.difference_amount  := (v_res->>'difference_amount')::bigint;
    NEW.cash_desk_result   := (v_res->>'counted')::bigint;
    NEW.cards_miss         := (v_res->>'cards_miss')::bigint;
    NEW.slots_result       := (v_res->>'slots_result')::bigint;
    NEW.balance            := (v_res->>'balance')::bigint;
  END IF;
  RETURN NEW;
END;
$$;

-- Opening snapshots should show the manual opening balance only.
WITH opening_totals AS (
  SELECT cc.id, COALESCE(SUM(i.total_tzs), 0)::bigint AS opening_total
  FROM public.cage_slots_cash_counts cc
  LEFT JOIN public.cage_slots_cash_inventory i
    ON i.cage_slots_shift_id = cc.cage_slots_shift_id
   AND i.inventory_type = 'opening'
  WHERE COALESCE((cc.denominations->>'is_opening')::boolean, false) IS TRUE
  GROUP BY cc.id
)
UPDATE public.cage_slots_cash_counts cc
SET total_tzs = ot.opening_total,
    denominations = jsonb_set(cc.denominations, '{totals,total_tzs}', to_jsonb(ot.opening_total), true)
FROM opening_totals ot
WHERE cc.id = ot.id;

-- Recalculate stored check snapshot totals under the new expected/count/difference logic.
WITH check_calc AS (
  SELECT
    cc.id,
    cc.cage_slots_shift_id,
    cc.total_tzs AS raw_counted,
    COALESCE(opening.opening_total, 0)::bigint AS opening_total,
    COALESCE(s.system_shift_result, 0)::bigint AS system_result,
    COALESCE(exp.expenses_total, 0)::bigint AS expenses_total,
    COALESCE(tr.collection, 0)::bigint AS collection,
    COALESCE(tr.fill, 0)::bigint AS fill,
    COALESCE(tr.lg_out, 0)::bigint AS lg_out,
    COALESCE(tr.lg_in, 0)::bigint AS lg_in,
    COALESCE(cl.cashless_out, 0)::bigint AS cashless_out,
    COALESCE(cl.cashless_in, 0)::bigint AS cashless_in,
    (COALESCE(c.opening_card_count, 0) - COALESCE(c.closing_card_count, 0))::bigint * COALESCE(c.card_deposit_value_tzs, 0)::bigint AS cards_miss
  FROM public.cage_slots_cash_counts cc
  JOIN public.cage_slots_shifts s ON s.id = cc.cage_slots_shift_id
  LEFT JOIN (
    SELECT cage_slots_shift_id, COALESCE(SUM(total_tzs), 0)::bigint AS opening_total
    FROM public.cage_slots_cash_inventory
    WHERE inventory_type = 'opening'
    GROUP BY cage_slots_shift_id
  ) opening ON opening.cage_slots_shift_id = cc.cage_slots_shift_id
  LEFT JOIN (
    SELECT cage_slots_shift_id, COALESCE(SUM(amount), 0)::bigint AS expenses_total
    FROM public.expenses
    WHERE approved = true
    GROUP BY cage_slots_shift_id
  ) exp ON exp.cage_slots_shift_id = cc.cage_slots_shift_id
  LEFT JOIN (
    SELECT cage_slots_shift_id,
           COALESCE(SUM(CASE WHEN transfer_type='collection' THEN amount END), 0)::bigint AS collection,
           COALESCE(SUM(CASE WHEN transfer_type='fill' THEN amount END), 0)::bigint AS fill,
           COALESCE(SUM(CASE WHEN transfer_type='lg_out' THEN amount END), 0)::bigint AS lg_out,
           COALESCE(SUM(CASE WHEN transfer_type='lg_in' THEN amount END), 0)::bigint AS lg_in
    FROM public.cage_slots_transfers
    GROUP BY cage_slots_shift_id
  ) tr ON tr.cage_slots_shift_id = cc.cage_slots_shift_id
  LEFT JOIN (
    SELECT cage_slots_shift_id,
           COALESCE(SUM(CASE WHEN direction='OUT' THEN amount END), 0)::bigint AS cashless_out,
           COALESCE(SUM(CASE WHEN direction='IN' THEN amount END), 0)::bigint AS cashless_in
    FROM public.cashless_transactions
    GROUP BY cage_slots_shift_id
  ) cl ON cl.cage_slots_shift_id = cc.cage_slots_shift_id
  LEFT JOIN public.cage_slots_cards c ON c.cage_slots_shift_id = cc.cage_slots_shift_id
  WHERE COALESCE((cc.denominations->>'is_opening')::boolean, false) IS FALSE
), final_calc AS (
  SELECT
    id,
    opening_total + system_result AS expected,
    raw_counted + expenses_total + collection - fill + lg_out - lg_in + cashless_out - cashless_in AS counted,
    cards_miss,
    system_result,
    raw_counted
  FROM check_calc
)
UPDATE public.cage_slots_cash_counts cc
SET denominations = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(cc.denominations, '{totals,total_tzs}', to_jsonb(fc.raw_counted), true),
              '{totals,expected}', to_jsonb(fc.expected), true
            ),
            '{totals,counted}', to_jsonb(fc.counted), true
          ),
          '{totals,difference}', to_jsonb(fc.counted - fc.expected), true
        ),
        '{totals,cards_miss}', to_jsonb(fc.cards_miss), true
      ),
      '{totals,balance}', to_jsonb((fc.counted - fc.expected) - fc.cards_miss), true
    )
FROM final_calc fc
WHERE cc.id = fc.id;

-- Recalculate every slots shift row under the same formula.
DO $$
DECLARE
  r public.cage_slots_shifts%ROWTYPE;
  j jsonb;
BEGIN
  FOR r IN SELECT * FROM public.cage_slots_shifts LOOP
    j := public.compute_slots_shift_balance_from_row(r);
    UPDATE public.cage_slots_shifts
       SET cash_desk_result   = (j->>'counted')::bigint,
           cards_miss         = (j->>'cards_miss')::bigint,
           slots_result       = (j->>'slots_result')::bigint,
           balance            = (j->>'balance')::bigint,
           actual_cage_result = (j->>'counted')::bigint,
           difference_amount  = (j->>'difference')::bigint
     WHERE id = r.id;
  END LOOP;
END $$;