-- Daily diff: canonical per-business-day P&L reconciliation.
-- Window for player transactions and drop split is 13:00 EAT → 05:00 EAT next day,
-- matching the active live-game session (excludes early-morning cage paperwork).
-- Result comes from shifts.tables_result (closed live shifts) bucketed by opened_at
-- via business_date_of (07:00 rollover).
-- Diff = Result + Player Result (no Miss subtraction).

CREATE OR REPLACE FUNCTION public.compute_daily_diff(
  _casino_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  business_date date,
  drop_r bigint,
  cash_in bigint,
  miss bigint,
  result bigint,
  hold numeric,
  player_result bigint,
  diff bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  win_from timestamptz;
  win_to   timestamptz;
  v_drop_r bigint;
  v_drop_v bigint;
  v_cash_in_tx bigint;
  v_cashout bigint;
  v_miss bigint;
  v_result bigint;
  v_player bigint;
  v_hold numeric;
BEGIN
  d := _from;
  WHILE d <= _to LOOP
    -- Live-game session window: 13:00 EAT → next day 05:00 EAT
    win_from := ((d::timestamp + time '13:00') AT TIME ZONE 'Africa/Dar_es_Salaam');
    win_to   := (((d + 1)::timestamp + time '05:00') AT TIME ZONE 'Africa/Dar_es_Salaam');

    -- Drop split (R = external new money, V = recycled)
    SELECT COALESCE(SUM(drop_r), 0)::bigint, COALESCE(SUM(drop_recycled), 0)::bigint
      INTO v_drop_r, v_drop_v
      FROM public.compute_tables_drop_split(_casino_id, win_from, win_to);

    -- Player transactions in the session window (exclude cancelled)
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('buy','in') THEN amount ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN type IN ('cashout','out') THEN amount ELSE 0 END), 0)::bigint
      INTO v_cash_in_tx, v_cashout
      FROM public.transactions
     WHERE casino_id = _casino_id
       AND cancelled_at IS NULL
       AND type IN ('buy','in','cashout','out')
       AND created_at >= win_from
       AND created_at <  win_to;

    -- Shifts: tables_result + miss_total for closed live shifts on this business day
    SELECT
      COALESCE(SUM(miss_total), 0)::bigint,
      COALESCE(SUM(tables_result), 0)::bigint
      INTO v_miss, v_result
      FROM public.shifts
     WHERE casino_id = _casino_id
       AND status = 'closed'
       AND public.business_date_of(opened_at) = d;

    v_player := v_cashout - v_cash_in_tx;
    v_hold := CASE WHEN v_drop_r <> 0 THEN (v_result::numeric / v_drop_r::numeric) * 100 ELSE NULL END;

    business_date := d;
    drop_r := v_drop_r;
    cash_in := v_drop_r + v_drop_v;
    miss := v_miss;
    result := v_result;
    hold := v_hold;
    player_result := v_player;
    diff := v_result + v_player;
    RETURN NEXT;

    d := d + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_daily_diff(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_daily_diff(uuid, date, date) TO service_role;