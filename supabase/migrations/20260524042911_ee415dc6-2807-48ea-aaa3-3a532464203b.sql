
ALTER TABLE public.table_daily_results ALTER COLUMN created_by DROP NOT NULL;

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
  v_from := (_business_date::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';
  v_to   := ((_business_date + 1)::timestamp + interval '13 hours') AT TIME ZONE 'Africa/Dar_es_Salaam';

  WITH drops AS (
    SELECT t.table_id, COALESCE(SUM(t.amount), 0)::numeric AS drop_amount
    FROM transactions t
    WHERE t.casino_id = _casino_id
      AND t.table_id IS NOT NULL
      AND t.cancelled_at IS NULL
      AND t.type IN ('buy'::transaction_type, 'in'::transaction_type)
      AND t.created_at >= v_from
      AND t.created_at < v_to
    GROUP BY t.table_id
  ),
  upsert AS (
    INSERT INTO public.table_daily_results (casino_id, table_id, date, drop_amount, created_by, source)
    SELECT _casino_id, d.table_id, _business_date, d.drop_amount, _user, 'shift' FROM drops d
    ON CONFLICT (casino_id, date, table_id)
    DO UPDATE SET drop_amount = EXCLUDED.drop_amount, updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upsert;
  RETURN v_count;
END;
$function$;
