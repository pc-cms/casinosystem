
-- Helper: business date for a timestamp (Africa/Dar_es_Salaam, 05:00 rollover)
CREATE OR REPLACE FUNCTION public.business_date_of(_ts timestamptz)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT (((_ts AT TIME ZONE 'Africa/Dar_es_Salaam') - interval '5 hours'))::date;
$$;

-- 1) Per-player single
CREATE OR REPLACE FUNCTION public.compute_player_drop_split(
  _player_id uuid,
  _from timestamptz DEFAULT '-infinity'::timestamptz,
  _to   timestamptz DEFAULT 'infinity'::timestamptz
)
RETURNS TABLE(drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  r record; nep bigint := 0; ext bigint; rec bigint;
  total_ext bigint := 0; total_rec bigint := 0;
  prev_bd date := NULL; cur_bd date;
BEGIN
  FOR r IN
    SELECT created_at, kind, amount, is_cash, id FROM (
      SELECT created_at,
             CASE WHEN type IN ('buy','in') THEN 'in'::text
                  WHEN type IN ('cashout','out') THEN 'out'::text END AS kind,
             amount::bigint AS amount, true AS is_cash, id
        FROM public.transactions
       WHERE player_id = _player_id AND cancelled_at IS NULL
      UNION ALL
      SELECT created_at, direction, amount::bigint, false, id
        FROM public.chip_transfers WHERE player_id = _player_id
      UNION ALL
      SELECT created_at, 'in', chip_in::bigint, true, id
        FROM public.player_chip_adjustments WHERE player_id = _player_id AND chip_in > 0
      UNION ALL
      SELECT created_at, 'out', chip_out::bigint, true, id
        FROM public.player_chip_adjustments WHERE player_id = _player_id AND chip_out > 0
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY created_at ASC, id ASC
  LOOP
    cur_bd := public.business_date_of(r.created_at);
    IF prev_bd IS DISTINCT FROM cur_bd THEN
      nep := 0; prev_bd := cur_bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec; nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from THEN
        total_ext := total_ext + ext; total_rec := total_rec + rec;
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  drop_r := total_ext; drop_recycled := total_rec; RETURN NEXT;
END;
$function$;

-- 2) Per-player batch by casino
CREATE OR REPLACE FUNCTION public.compute_players_drop_split(
  _casino_id uuid, _from timestamptz, _to timestamptz
)
RETURNS TABLE(player_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  prev_pid uuid := NULL; prev_bd date := NULL; cur_bd date;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (player_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;
  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id FROM (
      SELECT t.player_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text END AS kind,
             t.amount::bigint AS amount, true AS is_cash, t.created_at, t.id
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
    cur_bd := public.business_date_of(r.created_at);
    IF r.pid IS DISTINCT FROM prev_pid OR prev_bd IS DISTINCT FROM cur_bd THEN
      nep := 0; prev_pid := r.pid; prev_bd := cur_bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec; nep := nep + r.amount;
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

-- 3) Per-table batch by casino
CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(
  _casino_id uuid, _from timestamptz, _to timestamptz
)
RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  prev_pid uuid := NULL; prev_bd date := NULL; cur_bd date;
  nep bigint := 0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_tsplit (table_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_tsplit;
  FOR r IN
    SELECT e.player_id AS pid, e.table_id AS tid, e.kind, e.amount, e.is_cash, e.created_at, e.id
      FROM (
      SELECT t.player_id, t.table_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text END AS kind,
             t.amount::bigint AS amount, true AS is_cash, t.created_at, t.id
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
    cur_bd := public.business_date_of(r.created_at);
    IF r.pid IS DISTINCT FROM prev_pid OR prev_bd IS DISTINCT FROM cur_bd THEN
      nep := 0; prev_pid := r.pid; prev_bd := cur_bd;
    END IF;
    IF r.kind = 'in' THEN
      IF nep < 0 THEN rec := LEAST(r.amount, -nep); ELSE rec := 0; END IF;
      ext := r.amount - rec; nep := nep + r.amount;
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
