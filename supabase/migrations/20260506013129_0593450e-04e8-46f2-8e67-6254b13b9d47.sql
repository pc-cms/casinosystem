CREATE OR REPLACE FUNCTION public.compute_players_drop_split(
  _casino_id uuid, _from timestamptz, _to timestamptz
) RETURNS TABLE(player_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
DECLARE
  prev_pid uuid := NULL;
  nep bigint := 0;
  ext bigint;
  rec bigint;
  r record;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tmp_psplit (
    player_id uuid,
    ext bigint,
    rec bigint
  ) ON COMMIT DROP;
  TRUNCATE _tmp_psplit;

  FOR r IN
    SELECT e.player_id AS pid, e.kind, e.amount, e.is_cash, e.created_at, e.id
    FROM (
      SELECT t.player_id,
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
             ct.direction AS kind,
             ct.amount::bigint AS amount,
             false AS is_cash,
             ct.created_at, ct.id
        FROM public.chip_transfers ct
       WHERE ct.casino_id = _casino_id
    ) e
    WHERE e.kind IS NOT NULL AND e.created_at <= _to
    ORDER BY e.player_id, e.created_at ASC, e.id ASC
  LOOP
    IF r.pid IS DISTINCT FROM prev_pid THEN
      nep := 0;
      prev_pid := r.pid;
    END IF;

    IF r.kind = 'in' THEN
      IF nep < 0 THEN
        rec := LEAST(r.amount, -nep);
      ELSE
        rec := 0;
      END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.is_cash AND r.created_at >= _from THEN
        INSERT INTO _tmp_psplit(player_id, ext, rec) VALUES (r.pid, ext, rec);
      END IF;
    ELSIF r.kind = 'out' THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT s.player_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
    FROM _tmp_psplit s
    GROUP BY s.player_id;
END;
$$;