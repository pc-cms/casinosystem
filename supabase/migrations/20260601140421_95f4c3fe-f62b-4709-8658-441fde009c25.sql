-- Cage Slots: Tips CD payouts (Day/Evening) as real cash-out events.
-- Money physically leaves the cage when paid → closing cash drops → we add the
-- payout amount back into Cash Desk Result so the shift balance is neutral
-- relative to tips. Remove the legacy `- tips_cd` term from the balance.

CREATE TABLE IF NOT EXISTS public.cage_slots_tips_cd_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('day','evening')),
  amount bigint NOT NULL CHECK (amount >= 0),
  collected_amount bigint NOT NULL DEFAULT 0,
  note text DEFAULT '',
  operator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cage_slots_shift_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_cage_slots_tips_cd_payouts_shift
  ON public.cage_slots_tips_cd_payouts (cage_slots_shift_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cage_slots_tips_cd_payouts TO authenticated;
GRANT ALL ON public.cage_slots_tips_cd_payouts TO service_role;

ALTER TABLE public.cage_slots_tips_cd_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_tips_cd_payouts_select"
  ON public.cage_slots_tips_cd_payouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "slots_tips_cd_payouts_insert"
  ON public.cage_slots_tips_cd_payouts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "slots_tips_cd_payouts_update"
  ON public.cage_slots_tips_cd_payouts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "slots_tips_cd_payouts_delete_manager"
  ON public.cage_slots_tips_cd_payouts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Update balance RPC: include payouts in CDR (add back); drop tips_cd from balance.
CREATE OR REPLACE FUNCTION public.compute_slots_shift_balance_from_row(s cage_slots_shifts)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
  v_cashless_balance bigint := 0;
  v_cashless_final   bigint := 0;
  v_open_cards       int    := 0;
  v_close_cards      int    := 0;
  v_card_value       bigint := 0;
  v_cards_miss       bigint := 0;
  v_system_result    bigint := 0;
  v_slots_result     bigint := 0;
  v_delta_cash       bigint := 0;
  v_cash_desk_result bigint := 0;
  v_expected         bigint := 0;
  v_balance          bigint := 0;
  v_tips_cd          bigint := 0;
  v_tips_cd_payout_day     bigint := 0;
  v_tips_cd_payout_evening bigint := 0;
  v_tips_cd_payout         bigint := 0;
  v_closing_seed     jsonb;
  v_usd_rate         numeric := 0;
BEGIN
  SELECT COALESCE(rate_to_tzs, 0) INTO v_usd_rate
    FROM public.cage_slots_exchange_rates
   WHERE cage_slots_shift_id = s.id AND currency_code = 'USD' LIMIT 1;

  SELECT COALESCE(SUM(total_tzs), 0)::bigint INTO v_opening_cash_tzs
    FROM public.cage_slots_cash_inventory
   WHERE cage_slots_shift_id = s.id AND inventory_type = 'opening';

  SELECT COALESCE(SUM(total_tzs), 0)::bigint INTO v_closing_cash_tzs
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
      + COALESCE((SELECT SUM((value)::bigint) FROM jsonb_each_text(COALESCE(v_closing_seed->'mobile', '{}'::jsonb))), 0);
  END IF;

  SELECT COALESCE(SUM(amount), 0)::bigint INTO v_expenses
    FROM public.expenses
   WHERE casino_id = s.casino_id
     AND business_date = s.business_date
     AND COALESCE(source, 'live_game') = 'slots'
     AND approved = true;

  SELECT
    COALESCE(SUM(CASE WHEN transfer_type = 'fill'       THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'collection' THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_in'      THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN transfer_type = 'lg_out'     THEN amount END), 0)::bigint
  INTO v_add_float, v_collection, v_lg_in, v_lg_out
  FROM public.cage_slots_transfers WHERE cage_slots_shift_id = s.id;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'IN'  THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount END), 0)::bigint
  INTO v_cashless_in, v_cashless_out
  FROM public.cashless_transactions WHERE cage_slots_shift_id = s.id;

  v_cashless_balance := v_cashless_in - v_cashless_out;
  v_cashless_final   := COALESCE(s.cashless_final, 0)::bigint;

  SELECT COALESCE(opening_card_count, 0), COALESCE(closing_card_count, 0), COALESCE(card_deposit_value_tzs, 0)
  INTO v_open_cards, v_close_cards, v_card_value
  FROM public.cage_slots_cards WHERE cage_slots_shift_id = s.id;

  SELECT COALESCE(SUM(amount), 0)::bigint INTO v_tips_cd
    FROM public.cage_slots_tips_cd WHERE cage_slots_shift_id = s.id;

  SELECT
    COALESCE(SUM(CASE WHEN bucket = 'day'     THEN amount END), 0)::bigint,
    COALESCE(SUM(CASE WHEN bucket = 'evening' THEN amount END), 0)::bigint
  INTO v_tips_cd_payout_day, v_tips_cd_payout_evening
  FROM public.cage_slots_tips_cd_payouts WHERE cage_slots_shift_id = s.id;

  v_tips_cd_payout := v_tips_cd_payout_day + v_tips_cd_payout_evening;

  v_cards_miss       := (v_open_cards - v_close_cards)::bigint * v_card_value;
  v_system_result    := COALESCE(s.system_shift_result, 0)::bigint;
  v_slots_result     := v_system_result;
  v_expected         := v_system_result;
  v_delta_cash       := v_closing_cash_tzs - v_opening_cash_tzs;
  -- Tips CD payouts are real cash-outs (money left cage); add them back so balance is neutral.
  v_cash_desk_result := v_closing_cash_tzs + v_expenses - v_add_float + v_collection
                        + v_lg_out - v_lg_in + v_tips_cd_payout;
  -- Balance no longer subtracts tips_cd: payouts are accounted via CDR.
  v_balance          := v_cash_desk_result - v_system_result - v_cards_miss;

  RETURN jsonb_build_object(
    'opening_cash', v_opening_cash_tzs, 'closing_cash', v_closing_cash_tzs, 'delta_cash', v_delta_cash,
    'expenses', v_expenses, 'collection', v_collection, 'add_float', v_add_float,
    'lg_in', v_lg_in, 'lg_out', v_lg_out,
    'cashless_in', v_cashless_in, 'cashless_out', v_cashless_out,
    'cashless_balance', v_cashless_balance, 'cashless_final', v_cashless_final,
    'cards_miss', v_cards_miss, 'system_result', v_system_result,
    'slots_result', v_slots_result, 'slots_result_derived', v_slots_result,
    'expected', v_expected, 'cash_desk_result', v_cash_desk_result,
    'tips_cd', v_tips_cd,
    'tips_cd_payout_day', v_tips_cd_payout_day,
    'tips_cd_payout_evening', v_tips_cd_payout_evening,
    'tips_cd_payout', v_tips_cd_payout,
    'balance', v_balance
  );
END;
$function$;

-- Backfill: recompute balance for all slots shifts under new formula.
UPDATE public.cage_slots_shifts s
   SET balance = (public.compute_slots_shift_balance_from_row(s.*)->>'balance')::bigint;
