-- Per-day NEP reset: nep accumulator resets at start of each business day (05:00 EAT)
-- AND on player change. Result: yesterday's winnings do NOT neutralize today's buy-in.

CREATE OR REPLACE FUNCTION public.compute_players_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(player_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prev_pid uuid := NULL;
  prev_bd  date := NULL;
  nep bigint := 0;
  ext bigint;
  rec bigint;
  r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (player_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;
  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id,
           ((e.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '5 hours')::date AS bd
      FROM (
      SELECT t.player_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint AS amount,
             true              AS is_cash,
             t.created_at,
             t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.transactions t2
                      WHERE t2.player_id = t.player_id AND t2.casino_id = _casino_id)
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
    -- Reset NEP on player change OR business-day change (per-day reset)
    IF r.pid IS DISTINCT FROM prev_pid OR r.bd IS DISTINCT FROM prev_bd THEN
      nep := 0; prev_pid := r.pid; prev_bd := r.bd;
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

CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prev_pid uuid := NULL;
  prev_bd  date := NULL;
  nep bigint := 0;
  ext bigint;
  rec bigint;
  r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_split (table_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_split;
  FOR r IN
    SELECT e.player_id, e.t_table_id AS table_id, e.kind, e.amount, e.is_cash, e.created_at, e.id,
           ((e.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '5 hours')::date AS bd
      FROM (
      SELECT t.player_id, t.table_id AS t_table_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint, true, t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.transactions t2
                      WHERE t2.player_id = t.player_id AND t2.casino_id = _casino_id)
      UNION ALL
      SELECT ct.player_id, ct.table_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id
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
    IF r.player_id IS DISTINCT FROM prev_pid OR r.bd IS DISTINCT FROM prev_bd THEN
      nep := 0; prev_pid := r.player_id; prev_bd := r.bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from AND r.table_id IS NOT NULL THEN
        INSERT INTO _tmp_split VALUES (r.table_id, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  RETURN QUERY
    SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
      FROM _tmp_split s GROUP BY s.table_id;
END;
$function$;