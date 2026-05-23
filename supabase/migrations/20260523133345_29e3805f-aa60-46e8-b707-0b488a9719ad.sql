-- Recreate drop-split RPCs with cancelled_at filter

CREATE OR REPLACE FUNCTION public.compute_player_drop_split(_player_id uuid, _from timestamp with time zone DEFAULT '-infinity'::timestamp with time zone, _to timestamp with time zone DEFAULT 'infinity'::timestamp with time zone)
 RETURNS TABLE(drop_r bigint, drop_recycled bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE r record; nep bigint:=0; ext bigint; rec bigint; total_ext bigint:=0; total_rec bigint:=0;
BEGIN
  FOR r IN
    SELECT created_at, kind, amount, is_cash FROM (
      SELECT created_at, CASE WHEN type IN ('buy','in') THEN 'in'::text WHEN type IN ('cashout','out') THEN 'out'::text ELSE NULL END AS kind, amount::bigint AS amount, true AS is_cash, id FROM public.transactions WHERE player_id=_player_id AND cancelled_at IS NULL
      UNION ALL
      SELECT created_at, direction, amount::bigint, false, id FROM public.chip_transfers WHERE player_id=_player_id
      UNION ALL
      SELECT created_at, 'in'::text, chip_in::bigint, true, id FROM public.player_chip_adjustments WHERE player_id=_player_id AND chip_in>0
      UNION ALL
      SELECT created_at, 'out'::text, chip_out::bigint, true, id FROM public.player_chip_adjustments WHERE player_id=_player_id AND chip_out>0
    ) e WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY created_at ASC, id ASC
  LOOP
    IF r.kind='in' THEN
      IF nep<0 THEN rec:=LEAST(r.amount,-nep); ELSE rec:=0; END IF;
      ext:=r.amount-rec; nep:=nep+r.amount;
      IF r.is_cash AND r.created_at>=_from THEN total_ext:=total_ext+ext; total_rec:=total_rec+rec; END IF;
    ELSIF r.kind='out' THEN nep:=nep-r.amount; END IF;
  END LOOP;
  drop_r:=total_ext; drop_recycled:=total_rec; RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.compute_players_drop_split(_casino_id uuid, _from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(player_id uuid, drop_r bigint, drop_recycled bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  prev_pid uuid := NULL;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (player_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;
  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id
      FROM (
      SELECT t.player_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint AS amount, true AS is_cash,
             t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id AND t.cancelled_at IS NULL
      UNION ALL
      SELECT ct.player_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id
        FROM public.chip_transfers ct WHERE ct.casino_id = _casino_id
      UNION ALL
      SELECT pca.player_id, 'in', pca.chip_in::bigint, true, pca.created_at, pca.id
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_in > 0
      UNION ALL
      SELECT pca.player_id, 'out', pca.chip_out::bigint, true, pca.created_at, pca.id
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_out > 0
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.pid IS DISTINCT FROM prev_pid THEN
      nep := 0; prev_pid := r.pid;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from THEN
        INSERT INTO _tmp_psplit VALUES (r.pid, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  RETURN QUERY
    SELECT s.player_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
      FROM _tmp_psplit s GROUP BY s.player_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(_casino_id uuid, _from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  prev_pid uuid := NULL;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_tsplit (table_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_tsplit;
  FOR r IN
    SELECT e.player_id AS pid, e.table_id AS tid, e.kind, e.amount, e.is_cash, e.created_at, e.id
      FROM (
      SELECT t.player_id, t.table_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint AS amount, true AS is_cash,
             t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id AND t.cancelled_at IS NULL
      UNION ALL
      SELECT ct.player_id, NULL::uuid, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id
        FROM public.chip_transfers ct WHERE ct.casino_id = _casino_id
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'in', pca.chip_in::bigint, true, pca.created_at, pca.id
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_in > 0
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'out', pca.chip_out::bigint, true, pca.created_at, pca.id
        FROM public.player_chip_adjustments pca
       WHERE pca.casino_id = _casino_id AND pca.chip_out > 0
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.pid IS DISTINCT FROM prev_pid THEN
      nep := 0; prev_pid := r.pid;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from AND r.tid IS NOT NULL THEN
        INSERT INTO _tmp_tsplit VALUES (r.tid, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  RETURN QUERY
    SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
      FROM _tmp_tsplit s GROUP BY s.table_id;
END;
$function$;

-- compute_shift_close: exclude cancelled
CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift            RECORD;
  v_total_in         numeric := 0;
  v_total_out        numeric := 0;
  v_total_exp        numeric := 0;
  v_opening_total    numeric := 0;
  v_opening_chips    numeric := 0;
  v_opening_cash     numeric := 0;
  v_expected         numeric := 0;
  v_miss_total       bigint := 0;
  v_tables_res       numeric := 0;
  v_cash_result      numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'shift not found: %', p_shift_id; END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_total_in
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('buy','in') AND cancelled_at IS NULL;

  SELECT COALESCE(SUM(amount),0) INTO v_total_out
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type::text IN ('cashout','out') AND cancelled_at IS NULL;

  SELECT COALESCE(SUM(amount),0) INTO v_total_exp
    FROM public.expenses
   WHERE shift_id = p_shift_id;

  v_opening_total := COALESCE(((v_shift.opening_float -> 'totals' ->> 'total_tzs'))::numeric, 0);
  v_opening_chips := COALESCE(((v_shift.opening_float -> 'totals' ->> 'chips_tzs'))::numeric, 0);
  v_opening_cash := GREATEST(v_opening_total - v_opening_chips, 0);

  v_expected := v_opening_cash + v_total_in - v_total_out - v_total_exp;
  v_cash_result := v_total_in - v_total_out;
  v_miss_total := public.shift_miss_total_from_closing_count(v_shift.closing_count);
  v_tables_res := COALESCE(v_shift.tables_result, v_shift.shift_result, 0);

  RETURN jsonb_build_object(
    'shift_id',       p_shift_id,
    'opening_float',  v_opening_total,
    'opening_cash',   v_opening_cash,
    'opening_chips',  v_opening_chips,
    'total_in',       v_total_in,
    'total_out',      v_total_out,
    'total_expenses', v_total_exp,
    'expected_cash',  v_expected,
    'cash_result',    v_cash_result,
    'miss_total',     v_miss_total,
    'tables_result',  v_tables_res,
    'shift_result',   v_tables_res
  );
END;
$function$;

-- Daily table results: exclude cancelled
CREATE OR REPLACE FUNCTION public.populate_table_daily_results_for_day(_casino_id uuid, _business_date date, _user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from timestamptz;
  v_to   timestamptz;
  v_count integer := 0;
BEGIN
  v_from := (_business_date::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';
  v_to   := ((_business_date + 1)::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';

  WITH drops AS (
    SELECT t.table_id, COALESCE(SUM(t.amount), 0)::numeric AS drop_amount
    FROM transactions t
    WHERE t.casino_id = _casino_id
      AND t.table_id IS NOT NULL
      AND t.cancelled_at IS NULL
      AND t.type IN ('buy'::transaction_type, 'in'::transaction_type)
      AND t.created_at >= v_from
      AND t.created_at < v_to
    GROUP BY t.table_id
  ),
  upsert AS (
    INSERT INTO public.table_daily_results (casino_id, table_id, business_date, drop_amount, last_updated_by)
    SELECT _casino_id, d.table_id, _business_date, d.drop_amount, _user FROM drops d
    ON CONFLICT (casino_id, table_id, business_date)
    DO UPDATE SET drop_amount = EXCLUDED.drop_amount, last_updated_by = EXCLUDED.last_updated_by, updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upsert;
  RETURN v_count;
END;
$function$;

-- player_economy view: exclude cancelled
DROP VIEW IF EXISTS public.player_economy;
CREATE VIEW public.player_economy AS
 SELECT p.id AS player_id,
    p.casino_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.status,
    COALESCE(buy.total, 0::numeric) AS total_drop,
    COALESCE(cash.total, 0::numeric) AS total_cashout,
    COALESCE(exp.total, 0::numeric) AS total_expenses,
    COALESCE(split.drop_r, 0::bigint) AS total_drop_r,
    COALESCE(split.drop_recycled, 0::bigint) AS total_drop_recycled,
    COALESCE(cash.total, 0::numeric) - COALESCE(buy.total, 0::numeric) AS result,
    COALESCE(cash.total, 0::numeric) - COALESCE(buy.total, 0::numeric) - COALESCE(exp.total, 0::numeric) AS total,
    COALESCE(cash.total, 0::numeric) - COALESCE(buy.total, 0::numeric) - COALESCE(exp.total, 0::numeric) AS real_result
   FROM players p
     LEFT JOIN LATERAL ( SELECT sum(transactions.amount) AS total
           FROM transactions
          WHERE transactions.player_id = p.id AND transactions.cancelled_at IS NULL AND (transactions.type = ANY (ARRAY['buy'::transaction_type, 'in'::transaction_type]))) buy ON true
     LEFT JOIN LATERAL ( SELECT sum(transactions.amount) AS total
           FROM transactions
          WHERE transactions.player_id = p.id AND transactions.cancelled_at IS NULL AND (transactions.type = ANY (ARRAY['cashout'::transaction_type, 'out'::transaction_type]))) cash ON true
     LEFT JOIN LATERAL ( SELECT sum(expenses.amount) AS total
           FROM expenses
          WHERE expenses.player_id = p.id AND expenses.approved = true) exp ON true
     LEFT JOIN LATERAL ( SELECT player_drop_split_lifetime.drop_r,
            player_drop_split_lifetime.drop_recycled
           FROM player_drop_split_lifetime(p.id) player_drop_split_lifetime(drop_r, drop_recycled)) split ON true;