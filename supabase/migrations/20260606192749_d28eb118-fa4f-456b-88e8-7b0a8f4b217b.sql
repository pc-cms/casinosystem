CREATE OR REPLACE FUNCTION public.compute_daily_diff(_casino_id uuid, _from date, _to date)
 RETURNS TABLE(business_date date, drop_r bigint, cash_in bigint, miss bigint, result bigint, hold numeric, player_result bigint, diff bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    win_from := ((d::timestamp + time '13:00') AT TIME ZONE 'Africa/Dar_es_Salaam');
    win_to   := (((d + 1)::timestamp + time '05:00') AT TIME ZONE 'Africa/Dar_es_Salaam');

    SELECT COALESCE(SUM(s.drop_r), 0)::bigint, COALESCE(SUM(s.drop_recycled), 0)::bigint
      INTO v_drop_r, v_drop_v
      FROM public.compute_tables_drop_split(_casino_id, win_from, win_to) s;

    SELECT
      COALESCE(SUM(CASE WHEN t.type IN ('buy','in') THEN t.amount ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN t.type IN ('cashout','out') THEN t.amount ELSE 0 END), 0)::bigint
      INTO v_cash_in_tx, v_cashout
      FROM public.transactions t
     WHERE t.casino_id = _casino_id
       AND t.cancelled_at IS NULL
       AND t.type IN ('buy','in','cashout','out')
       AND t.created_at >= win_from
       AND t.created_at <  win_to;

    SELECT
      COALESCE(SUM(sh.miss_total), 0)::bigint,
      COALESCE(SUM(sh.tables_result), 0)::bigint
      INTO v_miss, v_result
      FROM public.shifts sh
     WHERE sh.casino_id = _casino_id
       AND sh.status = 'closed'
       AND public.business_date_of(sh.opened_at) = d;

    v_player := v_cashout - v_cash_in_tx;
    v_hold := CASE WHEN v_drop_r <> 0 THEN (v_result::numeric / v_drop_r::numeric) * 100 ELSE NULL END;

    business_date := d;
    drop_r := v_drop_r;
    cash_in := v_drop_r + v_drop_v;
    miss := v_miss;
    result := v_result;
    hold := v_hold;
    player_result := v_player;
    -- Diff = Result + Player Result − Miss Chips
    diff := v_result + v_player - v_miss;
    RETURN NEXT;

    d := d + 1;
  END LOOP;
END;
$function$;