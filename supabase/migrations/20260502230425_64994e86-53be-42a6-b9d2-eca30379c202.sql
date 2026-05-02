-- Extend NEP/Drop computation RPCs to merge chip_transfers into event stream.
-- chip direction='in' behaves like 'buy/in' (adds NEP), 'out' like 'cashout/out' (subtracts NEP).
-- Chip transfers contribute ZERO to drop_r/recycled by themselves — only via NEP shifts that
-- affect subsequent real transactions inside the window (and direction itself is excluded
-- from the window-bucketed drop totals because they are not cash through the cage).
-- That preserves "drop is liquid cash flow" semantics while still flowing NEP.

CREATE OR REPLACE FUNCTION public.compute_player_drop_split(
  _player_id uuid,
  _from timestamptz DEFAULT '-infinity'::timestamptz,
  _to   timestamptz DEFAULT 'infinity'::timestamptz
)
RETURNS TABLE(drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  r record;
  nep bigint := 0;
  ext bigint;
  rec bigint;
  total_ext bigint := 0;
  total_rec bigint := 0;
BEGIN
  FOR r IN
    SELECT created_at, kind, amount, is_cash
    FROM (
      SELECT created_at,
             CASE WHEN type IN ('buy','in') THEN 'in'::text
                  WHEN type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             amount::bigint AS amount,
             true AS is_cash,
             id
        FROM public.transactions
       WHERE player_id = _player_id
      UNION ALL
      SELECT created_at,
             direction AS kind,
             amount::bigint AS amount,
             false AS is_cash,
             id
        FROM public.chip_transfers
       WHERE player_id = _player_id
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY created_at ASC, id ASC
  LOOP
    IF r.kind = 'in' THEN
      IF nep < 0 THEN
        rec := LEAST(r.amount, -nep);
      ELSE
        rec := 0;
      END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      -- Only CASH events contribute to Drop R / Recycled buckets
      IF r.is_cash AND r.created_at >= _from THEN
        total_ext := total_ext + ext;
        total_rec := total_rec + rec;
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  drop_r := total_ext;
  drop_recycled := total_rec;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(
  _casino_id uuid,
  _from timestamptz,
  _to   timestamptz
)
RETURNS TABLE(table_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  prev_pid uuid := NULL;
  nep bigint := 0;
  ext bigint;
  rec bigint;
  r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_split (
    table_id uuid,
    ext bigint,
    rec bigint
  ) ON COMMIT DROP;
  TRUNCATE _tmp_split;

  FOR r IN
    SELECT player_id, t_table_id AS table_id, kind, amount, is_cash, created_at, id
    FROM (
      SELECT t.player_id,
             t.table_id AS t_table_id,
             CASE WHEN t.type IN ('buy','in') THEN 'in'::text
                  WHEN t.type IN ('cashout','out') THEN 'out'::text
                  ELSE NULL END AS kind,
             t.amount::bigint AS amount,
             true AS is_cash,
             t.created_at, t.id
        FROM public.transactions t
       WHERE t.player_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.transactions t2
            WHERE t2.player_id = t.player_id AND t2.casino_id = _casino_id
         )
      UNION ALL
      SELECT ct.player_id,
             ct.table_id AS t_table_id,
             ct.direction AS kind,
             ct.amount::bigint AS amount,
             false AS is_cash,
             ct.created_at, ct.id
        FROM public.chip_transfers ct
       WHERE ct.casino_id = _casino_id
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY player_id, created_at ASC, id ASC
  LOOP
    IF r.player_id IS DISTINCT FROM prev_pid THEN
      nep := 0;
      prev_pid := r.player_id;
    END IF;

    IF r.kind = 'in' THEN
      IF nep < 0 THEN
        rec := LEAST(r.amount, -nep);
      ELSE
        rec := 0;
      END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from AND r.table_id IS NOT NULL THEN
        INSERT INTO _tmp_split(table_id, ext, rec) VALUES (r.table_id, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
    FROM _tmp_split s
    GROUP BY s.table_id;
END;
$$;