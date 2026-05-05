CREATE OR REPLACE FUNCTION public.populate_table_daily_results_for_day(
  _casino_id uuid,
  _business_date date,
  _user uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from timestamptz;
  v_to   timestamptz;
  v_count integer := 0;
BEGIN
  -- Business-day window in UTC (anchored to Africa/Dar_es_Salaam 13:00 → next 13:00).
  v_from := ((_business_date::timestamp + INTERVAL '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');
  v_to   := (((_business_date + 1)::timestamp + INTERVAL '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

  WITH
  -- Drop = sum of buy/in transactions in business-day window, per table.
  drops AS (
    SELECT t.table_id, COALESCE(SUM(t.amount), 0)::numeric AS drop_amount
    FROM transactions t
    WHERE t.casino_id = _casino_id
      AND t.table_id IS NOT NULL
      AND t.type IN ('buy'::transaction_type, 'in'::transaction_type)
      AND t.created_at >= v_from
      AND t.created_at <  v_to
    GROUP BY t.table_id
  ),
  -- Result = latest table_tracker value (slot order 18:00 → 12:00 next day).
  results AS (
    SELECT DISTINCT ON (tt.table_id)
      tt.table_id,
      COALESCE(NULLIF(regexp_replace(tt.value::text, '[^0-9.\-]', '', 'g'), '')::numeric, 0) AS result
    FROM table_tracker tt
    WHERE tt.casino_id = _casino_id
      AND tt.date = _business_date
      AND tt.value IS NOT NULL
      AND tt.value::text <> ''
    ORDER BY tt.table_id,
             CASE WHEN EXTRACT(HOUR FROM tt.time_slot::time) >= 18
                  THEN EXTRACT(HOUR FROM tt.time_slot::time) - 18
                  ELSE EXTRACT(HOUR FROM tt.time_slot::time) + 6
             END DESC
  ),
  -- Open tray value = sum(denomination * expected_quantity) from chip_baseline per table.
  opens AS (
    SELECT cb.location_id AS table_id,
           COALESCE(SUM(cb.denomination * cb.expected_quantity), 0)::numeric AS open_value
    FROM chip_baseline cb
    WHERE cb.casino_id = _casino_id
      AND cb.location_type = 'table'
      AND cb.location_id IS NOT NULL
    GROUP BY cb.location_id
  ),
  -- Fills/Credits from cage_transfers in the business-day window, per table.
  fills AS (
    SELECT ct.table_id, COALESCE(SUM(ct.amount), 0)::numeric AS fill_value
    FROM cage_transfers ct
    WHERE ct.casino_id = _casino_id
      AND ct.table_id IS NOT NULL
      AND ct.transfer_type = 'fill'
      AND ct.created_at >= v_from
      AND ct.created_at <  v_to
    GROUP BY ct.table_id
  ),
  credits AS (
    SELECT ct.table_id, COALESCE(SUM(ct.amount), 0)::numeric AS credit_value
    FROM cage_transfers ct
    WHERE ct.casino_id = _casino_id
      AND ct.table_id IS NOT NULL
      AND ct.transfer_type = 'credit'
      AND ct.created_at >= v_from
      AND ct.created_at <  v_to
    GROUP BY ct.table_id
  ),
  -- Close tray value = sum(denom * actual_quantity) from latest chip_snapshots row per table for that date.
  -- chip_snapshots already store one row per (location, denom) for a given (date, location).
  closes AS (
    SELECT cs.location_id AS table_id,
           COALESCE(SUM(cs.denomination * cs.actual_quantity), 0)::numeric AS close_value
    FROM chip_snapshots cs
    WHERE cs.casino_id = _casino_id
      AND cs.date = _business_date
      AND cs.location_type = 'table'
      AND cs.location_id IS NOT NULL
    GROUP BY cs.location_id
  ),
  combined AS (
    SELECT
      gt.id AS table_id,
      COALESCE(o.open_value,    0) AS open_value,
      COALESCE(f.fill_value,    0) AS fill_value,
      COALESCE(cr.credit_value, 0) AS credit_value,
      COALESCE(cl.close_value,  0) AS close_value,
      COALESCE(d.drop_amount,   0) AS drop_amount,
      COALESCE(r.result,        0) AS result
    FROM gaming_tables gt
    LEFT JOIN drops   d  ON d.table_id  = gt.id
    LEFT JOIN results r  ON r.table_id  = gt.id
    LEFT JOIN opens   o  ON o.table_id  = gt.id
    LEFT JOIN fills   f  ON f.table_id  = gt.id
    LEFT JOIN credits cr ON cr.table_id = gt.id
    LEFT JOIN closes  cl ON cl.table_id = gt.id
    WHERE gt.casino_id = _casino_id
      AND (
        d.drop_amount IS NOT NULL OR r.result IS NOT NULL
        OR f.fill_value IS NOT NULL OR cr.credit_value IS NOT NULL
        OR cl.close_value IS NOT NULL
      )
  )
  INSERT INTO table_daily_results
    (casino_id, date, table_id, open, fill, credit, close,
     drop_amount, result, source, confirmed, created_by)
  SELECT _casino_id, _business_date, c.table_id,
         c.open_value, c.fill_value, c.credit_value, c.close_value,
         c.drop_amount, c.result,
         'shift', true, COALESCE(_user, '00000000-0000-0000-0000-000000000000'::uuid)
  FROM combined c
  ON CONFLICT (casino_id, date, table_id) DO UPDATE
    SET open        = EXCLUDED.open,
        fill        = EXCLUDED.fill,
        credit      = EXCLUDED.credit,
        close       = EXCLUDED.close,
        drop_amount = EXCLUDED.drop_amount,
        result      = EXCLUDED.result,
        source      = 'shift',
        confirmed   = true,
        updated_at  = now()
    -- Don't overwrite a manually imported row with shift data.
    WHERE table_daily_results.source <> 'imported';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Re-run for every already-closed day so historical rows get the new fields.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT casino_id, business_date, closed_by
    FROM business_day_closures
  LOOP
    PERFORM public.populate_table_daily_results_for_day(r.casino_id, r.business_date, r.closed_by);
  END LOOP;
END $$;