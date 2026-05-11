-- 0) Fix ambiguous column reference in compute_shift_table_results
--    (RETURNS TABLE(table_id ...) clashes with CTE columns named table_id)
CREATE OR REPLACE FUNCTION public.compute_shift_table_results(p_shift_id uuid)
RETURNS TABLE(table_id uuid, result numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  imported AS (
    SELECT tdr.table_id AS tid, tdr.result AS res
    FROM table_daily_results tdr
    WHERE tdr.casino_id = v_casino_id AND tdr.date = v_business_date
  ),
  latest AS (
    SELECT s.location_id AS tid, MAX(s.created_at) AS ts
    FROM chip_snapshots s
    WHERE s.casino_id = v_casino_id
      AND s.date = v_business_date
      AND s.location_type = 'table'
      AND s.location_id IS NOT NULL
    GROUP BY s.location_id
  ),
  snap_result AS (
    SELECT s.location_id AS tid,
           SUM((s.actual_quantity - COALESCE(b.expected_quantity, 0)) * s.denomination) AS res
    FROM chip_snapshots s
    JOIN latest l ON l.tid = s.location_id AND l.ts = s.created_at
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
  fc AS (
    SELECT ct.table_id AS tid,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'fill'   THEN ct.amount ELSE 0 END), 0)::numeric AS fill,
           COALESCE(SUM(CASE WHEN ct.transfer_type = 'credit' THEN ct.amount ELSE 0 END), 0)::numeric AS credit
    FROM cage_transfers ct
    WHERE ct.shift_id = p_shift_id
      AND ct.table_id IS NOT NULL
      AND ct.transfer_type IN ('fill','credit')
    GROUP BY ct.table_id
  ),
  ids AS (
    SELECT tid FROM imported
    UNION SELECT tid FROM snap_result
    UNION SELECT tid FROM fc
  )
  SELECT i.tid AS table_id,
         COALESCE(
           imp.res,
           COALESCE(sr.res, 0) - COALESCE(fc.fill, 0) + COALESCE(fc.credit, 0)
         )::numeric AS result
  FROM ids i
  LEFT JOIN imported    imp ON imp.tid = i.tid
  LEFT JOIN snap_result sr  ON sr.tid  = i.tid
  LEFT JOIN fc              ON fc.tid  = i.tid;
END;
$function$;

-- 1) Canonical tables_result column on shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS tables_result numeric;

-- 2) Helper that returns the canonical chip-based shift P&L total
CREATE OR REPLACE FUNCTION public.compute_shift_tables_result_total(p_shift_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(r.result), 0)::numeric
  FROM public.compute_shift_table_results(p_shift_id) r;
$$;

-- 3) Recalculate function — writes tables_result + shift_result alias
CREATE OR REPLACE FUNCTION public.recalc_shift_tables_result(p_shift_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
BEGIN
  v_total := public.compute_shift_tables_result_total(p_shift_id);
  UPDATE public.shifts
     SET tables_result = v_total,
         shift_result  = v_total
   WHERE id = p_shift_id;
  RETURN v_total;
END;
$$;

-- 4) On shift close → also write tables_result
CREATE OR REPLACE FUNCTION public.trg_apply_cage_shift_closing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status,'') <> 'closed' THEN
    PERFORM public.apply_cage_shift_closing(NEW.id);
    PERFORM public.recalc_shift_tables_result(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 5) chip_snapshots changes recompute affected closed shifts on same business day
CREATE OR REPLACE FUNCTION public.trg_recalc_shift_tables_on_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
  v_casino uuid;
  r record;
BEGIN
  v_date   := COALESCE(NEW.date, OLD.date);
  v_casino := COALESCE(NEW.casino_id, OLD.casino_id);
  IF v_date IS NULL OR v_casino IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  FOR r IN
    SELECT s.id
      FROM public.shifts s
     WHERE s.casino_id = v_casino
       AND s.status = 'closed'
       AND (timezone('Africa/Dar_es_Salaam', s.opened_at)::date
            - CASE WHEN EXTRACT(HOUR FROM timezone('Africa/Dar_es_Salaam', s.opened_at)) < 5
                   THEN 1 ELSE 0 END) = v_date
  LOOP
    PERFORM public.recalc_shift_tables_result(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalc_shift_tables_on_snapshot ON public.chip_snapshots;
CREATE TRIGGER recalc_shift_tables_on_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.chip_snapshots
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_shift_tables_on_snapshot();

-- 6) Backfill closed shifts (last 365 days)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.shifts
     WHERE status = 'closed'
       AND closed_at > now() - interval '365 days'
  LOOP
    PERFORM public.recalc_shift_tables_result(r.id);
  END LOOP;
END $$;

-- 7) Backfill daily_summaries.tables_result from shifts.tables_result
UPDATE public.daily_summaries ds
   SET tables_result = sub.total,
       total_result  = COALESCE(sub.total,0) + COALESCE(ds.slots_result,0)
  FROM (
    SELECT s.casino_id,
           (timezone('Africa/Dar_es_Salaam', s.opened_at)::date
            - CASE WHEN EXTRACT(HOUR FROM timezone('Africa/Dar_es_Salaam', s.opened_at)) < 5
                   THEN 1 ELSE 0 END) AS bdate,
           COALESCE(SUM(s.tables_result),0) AS total
      FROM public.shifts s
     WHERE s.status = 'closed'
     GROUP BY s.casino_id, bdate
  ) sub
 WHERE ds.casino_id = sub.casino_id
   AND ds.date      = sub.bdate;