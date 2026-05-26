CREATE OR REPLACE FUNCTION public.bridge_chip_snapshot_to_tracker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF current_setting('cms.applying_sync', true) = 'true' THEN
    RETURN NULL;
  END IF;

  FOR r IN
    WITH new_table_rows AS (
      SELECT casino_id, location_id, date, recorded_by, created_at,
             denomination, actual_quantity, expected_quantity
        FROM new_rows
       WHERE location_type = 'table' AND location_id IS NOT NULL
    ),
    latest AS (
      SELECT casino_id, location_id, date, max(created_at) AS latest_ts
        FROM new_table_rows
       GROUP BY casino_id, location_id, date
    ),
    batch AS (
      SELECT n.casino_id, n.location_id, n.date, n.recorded_by, n.created_at,
             sum((n.actual_quantity - n.expected_quantity) * n.denomination)::numeric AS result
        FROM new_table_rows n
        JOIN latest l
          ON l.casino_id = n.casino_id
         AND l.location_id = n.location_id
         AND l.date = n.date
         AND l.latest_ts = n.created_at
       GROUP BY n.casino_id, n.location_id, n.date, n.recorded_by, n.created_at
    )
    SELECT * FROM batch
  LOOP
    DECLARE
      ts_eat   timestamp := (r.created_at AT TIME ZONE 'Africa/Dar_es_Salaam');
      h        int       := extract(hour   from ts_eat)::int;
      m        int       := extract(minute from ts_eat)::int;
      final_w  boolean   := (h = 4 AND m >= 50) OR h IN (5,6,7);
      target_h int;
      only_if_empty boolean;
      slot text;
    BEGIN
      IF final_w THEN
        target_h := 5; only_if_empty := false;
      ELSIF m >= 50 THEN
        target_h := (h + 1) % 24; only_if_empty := false;
      ELSIF m <= 10 THEN
        target_h := h; only_if_empty := false;
      ELSE
        target_h := h; only_if_empty := true;
      END IF;

      IF NOT (target_h BETWEEN 19 AND 23 OR target_h BETWEEN 0 AND 4 OR final_w) THEN
        CONTINUE;
      END IF;

      slot := lpad(target_h::text, 2, '0') || ':00';

      IF only_if_empty THEN
        INSERT INTO public.table_tracker
          (casino_id, table_id, date, time_slot, value, recorded_by)
        VALUES
          (r.casino_id, r.location_id, r.date, slot, r.result, r.recorded_by)
        ON CONFLICT (table_id, date, time_slot) DO NOTHING;
      ELSE
        INSERT INTO public.table_tracker
          (casino_id, table_id, date, time_slot, value, recorded_by)
        VALUES
          (r.casino_id, r.location_id, r.date, slot, r.result, r.recorded_by)
        ON CONFLICT (table_id, date, time_slot)
        DO UPDATE SET value = EXCLUDED.value, recorded_by = EXCLUDED.recorded_by;
      END IF;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_chip_snapshot_to_tracker ON public.chip_snapshots;
CREATE TRIGGER trg_bridge_chip_snapshot_to_tracker
AFTER INSERT ON public.chip_snapshots
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.bridge_chip_snapshot_to_tracker();

-- One-off backfill for 2026-05-26 22:00
INSERT INTO public.table_tracker (casino_id, table_id, date, time_slot, value, recorded_by)
SELECT casino_id, location_id, date, '22:00', result, recorded_by
  FROM (
    SELECT s.casino_id, s.location_id, s.date,
           sum((s.actual_quantity - s.expected_quantity) * s.denomination)::numeric AS result,
           (array_agg(s.recorded_by))[1] AS recorded_by
      FROM public.chip_snapshots s
     WHERE s.date = DATE '2026-05-26'
       AND s.location_type = 'table'
       AND s.location_id IS NOT NULL
       AND (s.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')
            BETWEEN '2026-05-26 21:50:00'::timestamp AND '2026-05-26 22:10:00'::timestamp
     GROUP BY s.casino_id, s.location_id, s.date
  ) g
ON CONFLICT (table_id, date, time_slot) DO NOTHING;