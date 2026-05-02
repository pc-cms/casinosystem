-- ============================================================================
-- NEP (Net External Position) model: split each cash-in into External vs Recycled
-- ============================================================================

-- 1) Per-player split for an arbitrary time window.
--    Walks ALL transactions (buy/in/cashout/out) of the player chronologically,
--    maintains running NEP = sum(in) - sum(out), and for each in-window deposit
--    splits it into external (Drop R) and recycled (Drop V cash-side).
CREATE OR REPLACE FUNCTION public.compute_player_drop_split(
  _player_id uuid,
  _from timestamptz DEFAULT '-infinity'::timestamptz,
  _to   timestamptz DEFAULT  'infinity'::timestamptz
)
RETURNS TABLE (drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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
    SELECT created_at, type, amount::bigint AS amount
    FROM public.transactions
    WHERE player_id = _player_id
      AND created_at <= _to
    ORDER BY created_at ASC, id ASC
  LOOP
    IF r.type IN ('buy','in') THEN
      -- recycled covers any negative NEP (player playing on casino's money)
      IF nep < 0 THEN
        rec := LEAST(r.amount, -nep);
      ELSE
        rec := 0;
      END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.created_at >= _from THEN
        total_ext := total_ext + ext;
        total_rec := total_rec + rec;
      END IF;
    ELSIF r.type IN ('cashout','out') THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;
  drop_r := total_ext;
  drop_recycled := total_rec;
  RETURN NEXT;
END;
$$;

-- 2) Per-table split for a casino over a time window.
--    Same NEP walk per player, but additionally attributes external/recycled
--    of each deposit to that deposit's table_id.
CREATE OR REPLACE FUNCTION public.compute_tables_drop_split(
  _casino_id uuid,
  _from timestamptz,
  _to   timestamptz
)
RETURNS TABLE (table_id uuid, drop_r bigint, drop_recycled bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  pid uuid;
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
    SELECT t.player_id, t.table_id, t.type, t.amount::bigint AS amount, t.created_at
    FROM public.transactions t
    WHERE t.player_id IS NOT NULL
      AND t.created_at <= _to
      AND EXISTS (
        SELECT 1 FROM public.transactions t2
        WHERE t2.player_id = t.player_id
          AND t2.casino_id = _casino_id
      )
    ORDER BY t.player_id, t.created_at ASC, t.id ASC
  LOOP
    IF r.player_id IS DISTINCT FROM prev_pid THEN
      nep := 0;
      prev_pid := r.player_id;
    END IF;

    IF r.type IN ('buy','in') THEN
      IF nep < 0 THEN
        rec := LEAST(r.amount, -nep);
      ELSE
        rec := 0;
      END IF;
      ext := r.amount - rec;
      nep := nep + r.amount;
      IF r.created_at >= _from AND r.table_id IS NOT NULL THEN
        INSERT INTO _tmp_split(table_id, ext, rec) VALUES (r.table_id, ext, rec);
      END IF;
    ELSIF r.type IN ('cashout','out') THEN
      nep := nep - r.amount;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT s.table_id, COALESCE(SUM(s.ext),0)::bigint, COALESCE(SUM(s.rec),0)::bigint
    FROM _tmp_split s
    GROUP BY s.table_id;
END;
$$;

-- 3) Per-player lifetime split — used to extend player_economy view.
CREATE OR REPLACE FUNCTION public.player_drop_split_lifetime(_player_id uuid)
RETURNS TABLE (drop_r bigint, drop_recycled bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.compute_player_drop_split(_player_id, '-infinity'::timestamptz, 'infinity'::timestamptz);
$$;

-- 4) Replace player_economy view to include lifetime drop_r / drop_recycled.
DROP VIEW IF EXISTS public.player_economy;

CREATE VIEW public.player_economy
WITH (security_invoker = true)
AS
SELECT
  p.id AS player_id,
  p.casino_id,
  p.first_name,
  p.last_name,
  p.nickname,
  p.status,
  COALESCE(buy.total, 0)  AS total_drop,
  COALESCE(cash.total, 0) AS total_cashout,
  COALESCE(exp.total, 0)  AS total_expenses,
  COALESCE(split.drop_r, 0)        AS total_drop_r,
  COALESCE(split.drop_recycled, 0) AS total_drop_recycled,
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0)                          AS result,
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS total,
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS real_result
FROM public.players p
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type IN ('buy','in')
) buy ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type IN ('cashout','out')
) cash ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.expenses WHERE player_id = p.id AND approved = true
) exp ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.player_drop_split_lifetime(p.id)
) split ON true;

-- Grant execute on the new RPCs to authenticated users (RLS still applies via SECURITY INVOKER).
GRANT EXECUTE ON FUNCTION public.compute_player_drop_split(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_tables_drop_split(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_drop_split_lifetime(uuid) TO authenticated;