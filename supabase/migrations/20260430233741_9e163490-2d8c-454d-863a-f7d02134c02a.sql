-- ============================================================
-- PART A — FIX SYNC ENGINE RACE CONDITIONS
-- ============================================================

-- A1. Idempotent application helper. Sets sync.applying=on for the
-- duration of one statement so trg_sync_capture won't re-emit the
-- change back into outbox (loop guard).
CREATE OR REPLACE FUNCTION public.sync_apply_remote(
  p_casino_id uuid,
  p_local_id  bigint,
  p_table     text,
  p_op        text,
  p_pk        jsonb,
  p_payload   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean;
  v_sql      text;
BEGIN
  -- Atomic dedup via UNIQUE(casino_id, local_id)
  INSERT INTO public.sync_inbox_log (casino_id, local_id, table_name, op)
  VALUES (p_casino_id, p_local_id, p_table, p_op)
  ON CONFLICT (casino_id, local_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  -- Guard against bounce-back: capture trigger checks this GUC.
  PERFORM set_config('sync.applying','on', true);

  IF p_op = 'DELETE' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table)
      USING (p_pk->>'id')::uuid;
  ELSE
    -- Force authoritative casino_id, never trust client payload
    p_payload := jsonb_set(p_payload, '{casino_id}', to_jsonb(p_casino_id::text));

    -- UPSERT via dynamic SQL
    v_sql := format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)
         ON CONFLICT (id) DO UPDATE SET (%s) = (%s)',
      p_table, p_table,
      (SELECT string_agg(quote_ident(column_name), ',')
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=p_table AND column_name <> 'id'),
      (SELECT string_agg('EXCLUDED.'||quote_ident(column_name), ',')
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=p_table AND column_name <> 'id')
    );
    EXECUTE v_sql USING p_payload;
  END IF;

  RETURN jsonb_build_object('status','applied');
EXCEPTION WHEN OTHERS THEN
  -- Mark inbox row with error so we don't keep retrying same broken change
  UPDATE public.sync_inbox_log
     SET error = SQLERRM
   WHERE casino_id = p_casino_id AND local_id = p_local_id;
  RETURN jsonb_build_object('status','error','error',SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_apply_remote(uuid,bigint,text,text,jsonb,jsonb) FROM public, anon, authenticated;

-- A2. Stable PULL pagination (changed_at, id) — no ties.
CREATE INDEX IF NOT EXISTS idx_sync_outbox_changed_id
  ON public.sync_outbox (changed_at, id);

-- ============================================================
-- PART B — UI CALCULATIONS → DB (financial)
-- ============================================================

-- B1. Auto-discrepancy on cash_count_snapshots
CREATE OR REPLACE FUNCTION public.cash_count_snapshot_compute()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- physical_total_tzs falls back to physical_total * exchange_rate
  IF NEW.physical_total_tzs IS NULL OR NEW.physical_total_tzs = 0 THEN
    NEW.physical_total_tzs := COALESCE(NEW.physical_total,0) * COALESCE(NEW.exchange_rate,1);
  END IF;
  -- Authoritative discrepancy = expected − actual (TZS)
  NEW.discrepancy := COALESCE(NEW.expected_balance,0) - COALESCE(NEW.physical_total_tzs,0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_count_snapshot_compute ON public.cash_count_snapshots;
CREATE TRIGGER trg_cash_count_snapshot_compute
  BEFORE INSERT OR UPDATE ON public.cash_count_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.cash_count_snapshot_compute();

-- B2. RPC: compute_shift_close — single source of truth for shift result
CREATE OR REPLACE FUNCTION public.compute_shift_close(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift        RECORD;
  v_total_in     numeric := 0;
  v_total_out    numeric := 0;
  v_total_exp    numeric := 0;
  v_opening      numeric := 0;
  v_expected     numeric := 0;
  v_miss_total   numeric := 0;
  v_tables_res   numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift not found: %', p_shift_id;
  END IF;

  SELECT COALESCE(SUM(amount),0)
    INTO v_total_in
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type IN ('buy_in','cash_in');

  SELECT COALESCE(SUM(amount),0)
    INTO v_total_out
    FROM public.transactions
   WHERE shift_id = p_shift_id AND type IN ('cash_out','payout');

  SELECT COALESCE(SUM(amount),0)
    INTO v_total_exp
    FROM public.expenses
   WHERE shift_id = p_shift_id AND approved = true;

  v_opening := COALESCE(v_shift.opening_float, 0);
  v_expected := v_opening + v_total_in - v_total_out - v_total_exp;

  -- Miss chips for the shift (chip-conservation finalize)
  SELECT COALESCE(SUM(amount),0)
    INTO v_miss_total
    FROM public.miss_chips
   WHERE shift_id = p_shift_id;

  -- Tables result for the shift
  SELECT COALESCE(SUM(result),0)
    INTO v_tables_res
    FROM public.gaming_tables_history
   WHERE shift_id = p_shift_id;

  RETURN jsonb_build_object(
    'shift_id',       p_shift_id,
    'opening_float',  v_opening,
    'total_in',       v_total_in,
    'total_out',      v_total_out,
    'total_expenses', v_total_exp,
    'expected_cash',  v_expected,
    'miss_total',     v_miss_total,
    'tables_result',  v_tables_res
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_shift_close(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compute_shift_close(uuid) TO authenticated;