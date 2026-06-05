
-- 1) Drop the auto-close cron and helper (lock is manual + reconciled against real closure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-auto-close-old-days';
  END IF;
END$$;

DROP FUNCTION IF EXISTS public.fin_auto_close_old_days(int);

-- 2) Add variance note column
ALTER TABLE public.fin_day_closing
  ADD COLUMN IF NOT EXISTS variance_note text;

-- 3) Reconciling lock: compare entered Tables/Slots vs business_day_closures snapshot
CREATE OR REPLACE FUNCTION public.fin_lock_day_closing(p_id uuid, p_variance_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.fin_day_closing;
  v_snap jsonb;
  v_actual_tables numeric;
  v_actual_slots  numeric;
  v_diff_tables   numeric;
  v_diff_slots    numeric;
  v_needs_note    boolean;
  line jsonb;
BEGIN
  SELECT * INTO v FROM public.fin_day_closing WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'closing not found'; END IF;
  IF v.locked_at IS NOT NULL THEN RAISE EXCEPTION 'already locked'; END IF;

  -- Fetch the Cage closure snapshot for the same casino/date
  SELECT snapshot INTO v_snap
    FROM public.business_day_closures
   WHERE casino_id = v.casino_id AND business_date = v.business_date
   ORDER BY closed_at DESC
   LIMIT 1;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'Cannot lock: Cage business-day closure for % does not exist yet', v.business_date;
  END IF;

  v_actual_tables := COALESCE((v_snap->'totals'->>'tables_result')::numeric, 0);
  v_actual_slots  := COALESCE((v_snap->'totals'->>'slots_result')::numeric, 0);

  v_diff_tables := COALESCE(v.tables_result, 0) - v_actual_tables;
  v_diff_slots  := COALESCE(v.slots_result, 0)  - v_actual_slots;

  v_needs_note := (abs(v_diff_tables) > 1) OR (abs(v_diff_slots) > 1);

  IF v_needs_note AND (p_variance_note IS NULL OR length(btrim(p_variance_note)) < 3) THEN
    RAISE EXCEPTION 'Variance detected (tables Δ=%, slots Δ=%) — a reconciliation comment is required',
      v_diff_tables, v_diff_slots;
  END IF;

  -- Post incomes to ledger
  FOR line IN SELECT * FROM jsonb_array_elements(COALESCE(v.income_lines, '[]'::jsonb))
  LOOP
    IF (line->>'wallet_id') IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.fin_wallet_tx(
      casino_id, wallet_id, kind, amount, currency, fx_rate, amount_tzs,
      ref_table, ref_id, business_date, created_by, note
    )
    VALUES (
      v.casino_id, (line->>'wallet_id')::uuid, 'income',
      (line->>'amount')::numeric, line->>'currency',
      COALESCE((line->>'fx_rate')::numeric, 1),
      (line->>'amount')::numeric * COALESCE((line->>'fx_rate')::numeric, 1),
      'fin_day_closing', v.id, v.business_date, auth.uid(), 'Day closing income'
    );
  END LOOP;

  UPDATE public.fin_day_closing
     SET locked_at    = now(),
         closed_by    = auth.uid(),
         variance_note = p_variance_note
   WHERE id = p_id;

  INSERT INTO public.fin_audit_log(casino_id, actor, action, entity_table, entity_id, after)
  VALUES (v.casino_id, auth.uid(), 'lock', 'fin_day_closing', v.id,
          jsonb_build_object(
            'business_date', v.business_date,
            'entered_tables', v.tables_result,
            'entered_slots',  v.slots_result,
            'actual_tables',  v_actual_tables,
            'actual_slots',   v_actual_slots,
            'diff_tables',    v_diff_tables,
            'diff_slots',     v_diff_slots,
            'variance_note',  p_variance_note
          ));
END $$;

GRANT EXECUTE ON FUNCTION public.fin_lock_day_closing(uuid, text) TO authenticated;
-- Keep old single-arg signature out of use
DROP FUNCTION IF EXISTS public.fin_lock_day_closing(uuid);
