CREATE OR REPLACE FUNCTION public.compute_player_drop_split(_player_id uuid, _from timestamp with time zone DEFAULT '-infinity'::timestamp with time zone, _to timestamp with time zone DEFAULT 'infinity'::timestamp with time zone)
 RETURNS TABLE(drop_r bigint, drop_recycled bigint)
 LANGUAGE plpgsql VOLATILE SET search_path TO 'public'
AS $function$
DECLARE r record; nep bigint:=0; ext bigint; rec bigint; total_ext bigint:=0; total_rec bigint:=0;
BEGIN
  FOR r IN
    SELECT created_at, kind, amount, is_cash FROM (
      SELECT created_at, CASE WHEN type IN ('buy','in') THEN 'in'::text WHEN type IN ('cashout','out') THEN 'out'::text ELSE NULL END AS kind, amount::bigint AS amount, true AS is_cash, id FROM public.transactions WHERE player_id=_player_id
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
 LANGUAGE plpgsql VOLATILE SET search_path TO 'public'
AS $function$
DECLARE prev_pid uuid:=NULL; nep bigint:=0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (player_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;
  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id FROM (
      SELECT t.player_id, CASE WHEN t.type IN ('buy','in') THEN 'in'::text WHEN t.type IN ('cashout','out') THEN 'out'::text ELSE NULL END, t.amount::bigint, true, t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.transactions t2 WHERE t2.player_id=t.player_id AND t2.casino_id=_casino_id)
      UNION ALL
      SELECT ct.player_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id FROM public.chip_transfers ct WHERE ct.casino_id=_casino_id
      UNION ALL
      SELECT pca.player_id, 'in'::text, pca.chip_in::bigint, true, pca.created_at, pca.id FROM public.player_chip_adjustments pca WHERE pca.casino_id=_casino_id AND pca.chip_in>0
      UNION ALL
      SELECT pca.player_id, 'out'::text, pca.chip_out::bigint, true, pca.created_at, pca.id FROM public.player_chip_adjustments pca WHERE pca.casino_id=_casino_id AND pca.chip_out>0
    ) e WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.pid IS DISTINCT FROM prev_pid THEN nep:=0; prev_pid:=r.pid; END IF;
    IF r.kind='in' THEN
      IF nep<0 THEN rec:=LEAST(r.amount,-nep); ELSE rec:=0; END IF;
      ext:=r.amount-rec; nep:=nep+r.amount;
      IF r.is_cash AND r.created_at>=_from THEN INSERT INTO _tmp_psplit VALUES (r.pid,ext,rec); END IF;
    ELSIF r.kind='out' THEN nep:=nep-r.amount; END IF;
  END LOOP;
  RETURN QUERY SELECT s.player_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint FROM _tmp_psplit s GROUP BY s.player_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(_casino_id uuid, _from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
 LANGUAGE plpgsql VOLATILE SET search_path TO 'public'
AS $function$
DECLARE prev_pid uuid:=NULL; nep bigint:=0; ext bigint; rec bigint; r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_split (table_id uuid, ext bigint, rec bigint) ON COMMIT DROP;
  TRUNCATE _tmp_split;
  FOR r IN
    SELECT player_id, t_table_id AS table_id, kind, amount, is_cash, created_at, id FROM (
      SELECT t.player_id, t.table_id AS t_table_id, CASE WHEN t.type IN ('buy','in') THEN 'in'::text WHEN t.type IN ('cashout','out') THEN 'out'::text ELSE NULL END, t.amount::bigint, true, t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.transactions t2 WHERE t2.player_id=t.player_id AND t2.casino_id=_casino_id)
      UNION ALL
      SELECT ct.player_id, ct.table_id, ct.direction, ct.amount::bigint, false, ct.created_at, ct.id FROM public.chip_transfers ct WHERE ct.casino_id=_casino_id
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'in'::text, pca.chip_in::bigint, true, pca.created_at, pca.id FROM public.player_chip_adjustments pca WHERE pca.casino_id=_casino_id AND pca.chip_in>0
      UNION ALL
      SELECT pca.player_id, NULL::uuid, 'out'::text, pca.chip_out::bigint, true, pca.created_at, pca.id FROM public.player_chip_adjustments pca WHERE pca.casino_id=_casino_id AND pca.chip_out>0
    ) e WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY player_id, created_at ASC, id ASC
  LOOP
    IF r.player_id IS DISTINCT FROM prev_pid THEN nep:=0; prev_pid:=r.player_id; END IF;
    IF r.kind='in' THEN
      IF nep<0 THEN rec:=LEAST(r.amount,-nep); ELSE rec:=0; END IF;
      ext:=r.amount-rec; nep:=nep+r.amount;
      IF r.is_cash AND r.created_at>=_from AND r.table_id IS NOT NULL THEN INSERT INTO _tmp_split VALUES (r.table_id,ext,rec); END IF;
    ELSIF r.kind='out' THEN nep:=nep-r.amount; END IF;
  END LOOP;
  RETURN QUERY SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint FROM _tmp_split s GROUP BY s.table_id;
END; $function$;