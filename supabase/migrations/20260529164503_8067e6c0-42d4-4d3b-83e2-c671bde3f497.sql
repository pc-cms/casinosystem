CREATE OR REPLACE FUNCTION public.pos_shift_reconciliation(
  _casino_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  shift_id uuid,
  business_date date,
  shift_type text,
  waiter_user_id uuid,
  waiter_name text,
  opened_at timestamptz,
  closed_at timestamptz,
  gross_tzs bigint,
  cash_tzs bigint,
  card_tzs bigint,
  comp_player_tzs bigint,
  comp_house_tzs bigint,
  opening_cash bigint,
  closing_cash bigint,
  expected_cash bigint,
  cash_delta bigint,
  stock_variance_tzs bigint,
  outstanding_charges_tzs bigint,
  overrides_count int,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.business_date,
    s.shift_type,
    s.waiter_user_id,
    COALESCE(p.display_name, '') AS waiter_name,
    s.opened_at,
    s.closed_at,
    COALESCE((s.z_report->'totals'->>'gross_tzs')::bigint, 0),
    COALESCE((s.z_report->'totals'->>'cash')::bigint, 0),
    COALESCE((s.z_report->'totals'->>'card')::bigint, 0),
    COALESCE((s.z_report->'totals'->>'comp_player')::bigint, 0),
    COALESCE((s.z_report->'totals'->>'comp_house')::bigint, 0),
    COALESCE(s.opening_cash, 0),
    COALESCE(s.closing_cash, 0),
    COALESCE((s.z_report->>'expected_cash')::bigint, 0),
    COALESCE((s.z_report->>'cash_delta')::bigint,
             COALESCE(s.closing_cash, 0) - COALESCE((s.z_report->>'expected_cash')::bigint, 0)),
    COALESCE((
      SELECT SUM(sc.total_variance_value_tzs)
      FROM pos_stock_counts sc
      WHERE sc.shift_id = s.id AND sc.casino_id = _casino_id
    ), 0),
    COALESCE((
      SELECT SUM(c.amount_tzs)
      FROM pos_player_charges c
      JOIN pos_tabs t ON t.id = c.tab_id
      WHERE c.casino_id = _casino_id
        AND t.shift_id = s.id
        AND c.status = 'open'
    ), 0),
    COALESCE((
      SELECT COUNT(*)::int
      FROM pos_comp_budget_overrides o
      JOIN pos_tabs t ON t.id = o.tab_id
      WHERE t.shift_id = s.id
    ), 0),
    CASE
      WHEN s.closed_at IS NULL THEN 'open'
      WHEN ABS(COALESCE((s.z_report->>'cash_delta')::bigint, 0)) > 5000
        OR ABS(COALESCE((
            SELECT SUM(sc.total_variance_value_tzs)
            FROM pos_stock_counts sc WHERE sc.shift_id = s.id
          ), 0)) > 10000
        OR EXISTS (
            SELECT 1 FROM pos_comp_budget_overrides o
            JOIN pos_tabs t ON t.id = o.tab_id WHERE t.shift_id = s.id
          )
        THEN 'flagged'
      WHEN COALESCE((s.z_report->>'cash_delta')::bigint, 0) = 0
        AND COALESCE((
            SELECT SUM(sc.total_variance_value_tzs)
            FROM pos_stock_counts sc WHERE sc.shift_id = s.id
          ), 0) = 0
        THEN 'clean'
      ELSE 'minor'
    END AS status
  FROM pos_shifts s
  LEFT JOIN profiles p ON p.user_id = s.waiter_user_id
  WHERE s.casino_id = _casino_id
    AND s.business_date >= _from
    AND s.business_date <= _to
  ORDER BY s.business_date DESC, s.opened_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.pos_shift_reconciliation(uuid, date, date) TO authenticated;