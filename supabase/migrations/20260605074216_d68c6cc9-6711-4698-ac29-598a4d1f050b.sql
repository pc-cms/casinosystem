
-- Auto-close fin_day_closing rows older than N days (default 7)
CREATE OR REPLACE FUNCTION public.fin_auto_close_old_days(p_age_days int DEFAULT 7)
RETURNS TABLE(closed_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_row public.fin_day_closing;
BEGIN
  FOR v_row IN
    SELECT * FROM public.fin_day_closing
    WHERE locked_at IS NULL
      AND business_date < (CURRENT_DATE - p_age_days)
  LOOP
    -- Post incomes to wallet ledger (mirror fin_lock_day_closing behavior)
    INSERT INTO public.fin_wallet_tx
      (casino_id, wallet_id, fin_category_id, amount, currency, exchange_rate, amount_tzs, business_date, kind, source_table, source_id, description, created_by)
    SELECT
      v_row.casino_id,
      (line->>'wallet_id')::uuid,
      (line->>'fin_category_id')::uuid,
      (line->>'amount')::numeric,
      COALESCE(line->>'currency','TZS'),
      COALESCE((line->>'exchange_rate')::numeric, 1),
      (line->>'amount')::numeric * COALESCE((line->>'exchange_rate')::numeric, 1),
      v_row.business_date,
      'income',
      'fin_day_closing',
      v_row.id,
      'Day closing income (auto-locked)',
      v_row.closed_by
    FROM jsonb_array_elements(COALESCE(v_row.income_lines, '[]'::jsonb)) AS line
    WHERE (line->>'wallet_id') IS NOT NULL
      AND (line->>'fin_category_id') IS NOT NULL
      AND COALESCE((line->>'amount')::numeric, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.fin_wallet_tx t
        WHERE t.source_table = 'fin_day_closing' AND t.source_id = v_row.id
      );

    UPDATE public.fin_day_closing
      SET locked_at = now()
      WHERE id = v_row.id;

    INSERT INTO public.fin_audit_log (casino_id, actor, action, entity_table, entity_id, meta)
    VALUES (v_row.casino_id, NULL, 'auto_lock', 'fin_day_closing', v_row.id,
            jsonb_build_object('business_date', v_row.business_date, 'age_days', p_age_days));

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fin_auto_close_old_days(int) FROM public;
GRANT EXECUTE ON FUNCTION public.fin_auto_close_old_days(int) TO authenticated, service_role;

-- Schedule via pg_cron: every day at 02:00 UTC (= 05:00 EAT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('fin-auto-close-old-days') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'fin-auto-close-old-days'
    );
    PERFORM cron.schedule(
      'fin-auto-close-old-days',
      '0 2 * * *',
      $cron$ SELECT public.fin_auto_close_old_days(7); $cron$
    );
  END IF;
END$$;
