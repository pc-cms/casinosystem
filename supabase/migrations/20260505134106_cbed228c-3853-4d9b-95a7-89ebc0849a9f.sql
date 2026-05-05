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
  v_from := ((_business_date::timestamp + INTERVAL '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');
  v_to   := (((_business_date + 1)::timestamp + INTERVAL '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

  WITH drops AS (
    SELECT t.table_id, COALESCE(SUM(t.amount), 0)::numeric AS drop_amount
    FROM transactions t
    WHERE t.casino_id = _casino_id
      AND t.table_id IS NOT NULL
      AND t.type IN ('buy'::transaction_type, 'in'::transaction_type)
      AND t.created_at >= v_from
      AND t.created_at <  v_to
    GROUP BY t.table_id
  ),
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
  combined AS (
    SELECT
      gt.id AS table_id,
      COALESCE(d.drop_amount, 0) AS drop_amount,
      COALESCE(r.result, 0)      AS result
    FROM gaming_tables gt
    LEFT JOIN drops   d ON d.table_id = gt.id
    LEFT JOIN results r ON r.table_id = gt.id
    WHERE gt.casino_id = _casino_id
      AND (d.drop_amount IS NOT NULL OR r.result IS NOT NULL)
  )
  INSERT INTO table_daily_results
    (casino_id, date, table_id, open, fill, credit, close,
     drop_amount, result, source, confirmed, created_by)
  SELECT _casino_id, _business_date, c.table_id,
         0, 0, 0, 0,
         c.drop_amount, c.result,
         'shift', true, COALESCE(_user, '00000000-0000-0000-0000-000000000000'::uuid)
  FROM combined c
  ON CONFLICT (casino_id, date, table_id) DO UPDATE
    SET drop_amount = EXCLUDED.drop_amount,
        result      = EXCLUDED.result,
        source      = 'shift',
        confirmed   = true,
        updated_at  = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT bdc.casino_id, bdc.business_date, bdc.closed_by
    FROM business_day_closures bdc
    WHERE NOT EXISTS (
      SELECT 1 FROM table_daily_results tdr
      WHERE tdr.casino_id = bdc.casino_id
        AND tdr.date = bdc.business_date
        AND tdr.source = 'shift'
    )
  LOOP
    PERFORM public.populate_table_daily_results_for_day(r.casino_id, r.business_date, r.closed_by);
  END LOOP;
END $$;