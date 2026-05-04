-- Fix build_business_day_snapshot: expenses table has no business_date column.
-- Use shift_id-based filter (expenses linked to a shift opened on _business_date)
-- with a fallback to created_at::date.
CREATE OR REPLACE FUNCTION public.build_business_day_snapshot(_casino_id uuid, _business_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
BEGIN
  result := jsonb_set(result, '{cash_counts}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cash_count_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.created_at::date = _business_date
  ), '[]'::jsonb));

  -- Expenses: filter by attached shift's opened business day, fallback to created_at::date
  result := jsonb_set(result, '{expenses}', COALESCE((
    SELECT jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at)
    FROM expenses e
    LEFT JOIN shifts s ON s.id = e.shift_id
    WHERE e.casino_id = _casino_id
      AND (
        (s.opened_at IS NOT NULL
          AND ((s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date
               - CASE WHEN EXTRACT(HOUR FROM (s.opened_at AT TIME ZONE 'Africa/Dar_es_Salaam')) < 5 THEN 1 ELSE 0 END
              ) = _business_date)
        OR (s.id IS NULL AND e.created_at::date = _business_date)
      )
  ), '[]'::jsonb));

  result := jsonb_set(result, '{cashless}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cashless_transactions c
    WHERE c.casino_id = _casino_id
      AND c.business_date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{table_tracker}', COALESCE((
    SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.time_slot)
    FROM table_tracker t
    WHERE t.casino_id = _casino_id
      AND t.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{chip_snapshots}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM chip_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{breaklist}', COALESCE((
    SELECT jsonb_agg(to_jsonb(b.*) ORDER BY b.time_slot, b.dealer_id)
    FROM breaklist b
    WHERE b.casino_id = _casino_id
      AND b.date = _business_date
  ), '[]'::jsonb));

  result := jsonb_set(result, '{player_stats}', COALESCE((
    SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.started_at)
    FROM client_sessions s
    WHERE s.casino_id = _casino_id
      AND s.started_at::date = _business_date
  ), '[]'::jsonb));

  RETURN result;
END;
$function$;