-- Server-side computation of per-table Result for a shift.
-- Formula: Σ((snapshot.actual − chip_baseline.expected) × denom) − Fill + Credit
-- - Snapshot: latest chip_snapshots batch for the table on shift's business date.
-- - Baseline: chip_baseline.expected_quantity per denom (location_type='table').
-- - Fill/Credit: cage_transfers tied to the shift_id.
-- - If table_daily_results.result exists for the date (legacy import), it wins.

CREATE OR REPLACE FUNCTION public.compute_shift_table_results(p_shift_id uuid)
RETURNS TABLE(table_id uuid, result numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id uuid;
  v_business_date date;
BEGIN
  SELECT s.casino_id,
         (timezone('Africa/Dar_es_Salaam', s.opened_at)::date
          - CASE WHEN EXTRACT(HOUR FROM timezone('Africa/Dar_es_Salaam', s.opened_at)) < 5
                 THEN 1 ELSE 0 END)::date
  INTO v_casino_id, v_business_date
  FROM shifts s WHERE s.id = p_shift_id;

  IF v_casino_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Imported (legacy) per-table totals win when present.
  imported AS (
    SELECT tdr.table_id, tdr.result
    FROM table_daily_results tdr
    WHERE tdr.casino_id = v_casino_id AND tdr.date = v_business_date
  ),
  -- Latest chip_snapshots batch per table for the business date.
  latest AS (
    SELECT s.location_id AS table_id, MAX(s.created_at) AS ts
    FROM chip_snapshots s
    WHERE s.casino_id = v_casino_id
      AND s.date = v_business_date
      AND s.location_type = 'table'
      AND s.location_id IS NOT NULL
    GROUP BY s.location_id
  ),
  snap_result AS (
    SELECT s.location_id AS table_id,
           SUM((s.actual_quantity - COALESCE(b.expected_quantity, 0)) * s.denomination) AS res
    FROM chip_snapshots s
    JOIN latest l ON l.table_id = s.location_id AND l.ts = s.created_at
    LEFT JOIN chip_baseline b
      ON b.casino_id = s.casino_id
     AND b.location_type = 'table'
     AND b.location_id = s.location_id
     AND b.denomination = s.denomination
    WHERE s.casino_id = v_casino_id
      AND s.date = v_business_date
      AND s.location_type = 'table'
    GROUP BY s.location_id
  ),
  -- Fill / Credit aggregated per table for THIS shift.
  fc AS (
    SELECT ct.table_id,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'fill'   THEN ct.amount ELSE 0 END), 0)::numeric AS fill,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'credit' THEN ct.amount ELSE 0 END), 0)::numeric AS credit
    FROM cage_transfers ct
    WHERE ct.shift_id = p_shift_id
      AND ct.table_id IS NOT NULL
      AND ct.transfer_type IN ('fill','credit')
    GROUP BY ct.table_id
  ),
  -- Universe of tables that appear anywhere for this shift/date.
  ids AS (
    SELECT table_id FROM imported
    UNION SELECT table_id FROM snap_result
    UNION SELECT table_id FROM fc
  )
  SELECT i.table_id,
         COALESCE(
           imp.result,
           COALESCE(sr.res, 0) - COALESCE(fc.fill, 0) + COALESCE(fc.credit, 0)
         )::numeric AS result
  FROM ids i
  LEFT JOIN imported    imp ON imp.table_id = i.table_id
  LEFT JOIN snap_result sr  ON sr.table_id  = i.table_id
  LEFT JOIN fc              ON fc.table_id  = i.table_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_shift_table_results(uuid) TO anon, authenticated;