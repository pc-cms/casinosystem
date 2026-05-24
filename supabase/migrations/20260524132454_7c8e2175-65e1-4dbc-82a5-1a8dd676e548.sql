CREATE OR REPLACE FUNCTION public.populate_table_daily_results_for_day(_casino_id uuid, _business_date date, _user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from timestamptz;
  v_to   timestamptz;
  v_count integer := 0;
BEGIN
  -- Business day window: D 11:00 EAT → D+1 11:00 EAT (13:00 UTC offsets cover EAT).
  -- Kept identical to the previous version so drop windowing is unchanged.
  v_from := (_business_date::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';
  v_to   := ((_business_date + 1)::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';

  WITH
  -- 1) Drop per table from cashier IN transactions inside the business day window.
  drops AS (
    SELECT t.table_id,
           COALESCE(SUM(t.amount), 0)::numeric AS drop_amount
    FROM transactions t
    WHERE t.casino_id = _casino_id
      AND t.table_id IS NOT NULL
      AND t.cancelled_at IS NULL
      AND t.type IN ('buy'::transaction_type, 'in'::transaction_type)
      AND t.created_at >= v_from
      AND t.created_at <  v_to
    GROUP BY t.table_id
  ),
  -- 2) Shifts whose business date matches (for Fill/Credit lookup).
  day_shifts AS (
    SELECT s.id
    FROM shifts s
    WHERE s.casino_id = _casino_id
      AND ((timezone('Africa/Dar_es_Salaam', s.opened_at)::date
            - CASE WHEN EXTRACT(HOUR FROM timezone('Africa/Dar_es_Salaam', s.opened_at)) < 5
                   THEN 1 ELSE 0 END)::date) = _business_date
  ),
  -- 3) Latest chip snapshot per table for that business date.
  latest AS (
    SELECT cs.location_id AS tid, MAX(cs.created_at) AS ts
    FROM chip_snapshots cs
    WHERE cs.casino_id = _casino_id
      AND cs.date = _business_date
      AND cs.location_type = 'table'
      AND cs.location_id IS NOT NULL
    GROUP BY cs.location_id
  ),
  snap_result AS (
    SELECT cs.location_id AS tid,
           SUM((cs.actual_quantity - COALESCE(b.expected_quantity, 0)) * cs.denomination) AS res
    FROM chip_snapshots cs
    JOIN latest l
      ON l.tid = cs.location_id
     AND l.ts  = cs.created_at
    LEFT JOIN chip_baseline b
      ON b.casino_id      = cs.casino_id
     AND b.location_type  = 'table'
     AND b.location_id    = cs.location_id
     AND b.denomination   = cs.denomination
    WHERE cs.casino_id = _casino_id
      AND cs.date = _business_date
      AND cs.location_type = 'table'
    GROUP BY cs.location_id
  ),
  -- 4) Fill / Credit per table across all shifts that belong to this business day.
  fc AS (
    SELECT ct.table_id AS tid,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'fill'   THEN ct.amount ELSE 0 END), 0)::numeric AS fill,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'credit' THEN ct.amount ELSE 0 END), 0)::numeric AS credit
    FROM cage_transfers ct
    WHERE ct.shift_id IN (SELECT id FROM day_shifts)
      AND ct.table_id IS NOT NULL
      AND ct.transfer_type IN ('fill','credit')
    GROUP BY ct.table_id
  ),
  -- 5) Union of all table ids that show up in drop or result side.
  ids AS (
    SELECT table_id AS tid FROM drops
    UNION
    SELECT tid FROM snap_result
    UNION
    SELECT tid FROM fc
  ),
  combined AS (
    SELECT i.tid AS table_id,
           COALESCE(d.drop_amount, 0)::numeric AS drop_amount,
           (COALESCE(sr.res, 0) - COALESCE(fc.fill, 0) + COALESCE(fc.credit, 0))::numeric AS result
    FROM ids i
    LEFT JOIN drops       d  ON d.table_id = i.tid
    LEFT JOIN snap_result sr ON sr.tid     = i.tid
    LEFT JOIN fc            ON fc.tid     = i.tid
  ),
  upsert AS (
    INSERT INTO public.table_daily_results
      (casino_id, table_id, date, drop_amount, result, created_by, source)
    SELECT _casino_id, c.table_id, _business_date,
           c.drop_amount, c.result, _user, 'shift'
    FROM combined c
    ON CONFLICT (casino_id, date, table_id)
    DO UPDATE
      SET drop_amount = EXCLUDED.drop_amount,
          -- Never overwrite results that came from a manual import.
          result      = CASE
                          WHEN public.table_daily_results.source = 'import'
                          THEN public.table_daily_results.result
                          ELSE EXCLUDED.result
                        END,
          updated_at  = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upsert;

  RETURN v_count;
END;
$function$;

-- Backfill the days that the user is currently looking at.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT id FROM casinos LOOP
    PERFORM public.populate_table_daily_results_for_day(c.id, DATE '2026-05-22', NULL);
    PERFORM public.populate_table_daily_results_for_day(c.id, DATE '2026-05-23', NULL);
  END LOOP;
END $$;