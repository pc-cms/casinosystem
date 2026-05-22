CREATE OR REPLACE FUNCTION public.compute_players_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
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
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id
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
    -- Reset NEP only when switching to a new player. NEP is strictly LIFETIME
    -- per player — previous business days carry over so winnings the player
    -- still holds correctly reduce the "external" portion of new cash-ins.
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

-- Same bug exists in compute_tables_drop_split — apply the same fix there.
CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(_casino_id uuid, _from timestamptz, _to timestamptz)
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
       WHERE t.player_id IS NOT NULL AND t.casino_id = _casino_id
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