CREATE OR REPLACE FUNCTION public.am_performance_summary(
  _am_id uuid,
  _casino_id uuid DEFAULT NULL,
  _from date DEFAULT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 30,
  _to date DEFAULT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  WITH
  -- AM-issued grants in window (am_user_id is on promo_grants via funding_pool_ref? No: am_budget_ledger has am_user_id)
  am_grants AS (
    SELECT pg.id, pg.player_id, pg.casino_id, pg.amount, pg.issued_business_date, pg.expires_business_date, pg.status
    FROM promo_grants pg
    JOIN am_budget_ledger l
      ON l.ref_type = 'promo_grant' AND l.ref_id = pg.id AND l.am_user_id = _am_id
    WHERE pg.issued_business_date BETWEEN _from AND _to
      AND (_casino_id IS NULL OR pg.casino_id = _casino_id)
  ),
  ledger AS (
    SELECT reason, COALESCE(SUM(-delta) FILTER (WHERE delta < 0), 0) AS debit,
           COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0) AS credit
    FROM am_budget_ledger
    WHERE am_user_id = _am_id
      AND created_at::date BETWEEN _from AND _to
      AND (_casino_id IS NULL OR casino_id = _casino_id)
    GROUP BY reason
  ),
  redemptions AS (
    SELECT r.player_id, SUM(r.amount) AS redeemed
    FROM promo_redemptions r
    WHERE r.player_id IN (SELECT DISTINCT player_id FROM am_grants)
      AND r.created_at::date BETWEEN _from AND _to
      AND (_casino_id IS NULL OR r.casino_id = _casino_id)
    GROUP BY r.player_id
  ),
  visits AS (
    SELECT v.player_id, COUNT(*) AS visit_count, MAX(v.date) AS last_visit
    FROM casino_visits v
    WHERE v.player_id IN (SELECT DISTINCT player_id FROM am_grants)
      AND v.date BETWEEN _from AND _to
      AND (_casino_id IS NULL OR v.casino_id = _casino_id)
    GROUP BY v.player_id
  ),
  nep AS (
    SELECT s.player_id, SUM(COALESCE(s.total_bet, 0) - COALESCE(s.total_bet * 0, 0))::bigint AS nep
    FROM client_sessions s
    WHERE s.player_id IN (SELECT DISTINCT player_id FROM am_grants)
      AND s.started_at::date BETWEEN _from AND _to
      AND (_casino_id IS NULL OR s.casino_id = _casino_id)
    GROUP BY s.player_id
  ),
  per_player AS (
    SELECT
      g.player_id,
      p.first_name, p.last_name,
      COALESCE(SUM(g.amount), 0)::bigint AS granted,
      COALESCE(MAX(r.redeemed), 0)::bigint AS redeemed,
      COALESCE(MAX(v.visit_count), 0)::int AS visits,
      MAX(v.last_visit) AS last_visit,
      COALESCE(MAX(n.nep), 0)::bigint AS nep
    FROM am_grants g
    LEFT JOIN players p ON p.id = g.player_id
    LEFT JOIN redemptions r ON r.player_id = g.player_id
    LEFT JOIN visits v ON v.player_id = g.player_id
    LEFT JOIN nep n ON n.player_id = g.player_id
    GROUP BY g.player_id, p.first_name, p.last_name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'topped_up', COALESCE((SELECT credit FROM ledger WHERE reason = 'top_up'), 0),
      'granted',   COALESCE((SELECT debit  FROM ledger WHERE reason = 'grant'),  0),
      'cashback',  COALESCE((SELECT debit  FROM ledger WHERE reason = 'cashback'), 0),
      'reversed',  COALESCE((SELECT credit FROM ledger WHERE reason = 'reversal'), 0),
      'redeemed',  COALESCE((SELECT SUM(redeemed) FROM per_player), 0),
      'nep',       COALESCE((SELECT SUM(nep) FROM per_player), 0)
    ),
    'funnel', jsonb_build_object(
      'players_granted',  (SELECT COUNT(*) FROM per_player),
      'players_visited',  (SELECT COUNT(*) FROM per_player WHERE visits > 0),
      'players_redeemed', (SELECT COUNT(*) FROM per_player WHERE redeemed > 0)
    ),
    'players', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'player_id', player_id,
        'first_name', first_name,
        'last_name', last_name,
        'granted', granted,
        'redeemed', redeemed,
        'visits', visits,
        'last_visit', last_visit,
        'nep', nep
      ) ORDER BY granted DESC) FROM per_player), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.am_performance_summary(uuid, uuid, date, date) TO authenticated;