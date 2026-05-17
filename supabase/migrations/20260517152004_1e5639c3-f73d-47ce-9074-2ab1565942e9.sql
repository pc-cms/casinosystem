
-- ===== node_modes: per-casino replication mode =====
CREATE TABLE IF NOT EXISTS public.node_modes (
  casino_id uuid PRIMARY KEY REFERENCES public.casinos(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'cloud_primary' CHECK (mode IN ('cloud_primary','local_primary')),
  promoted_at timestamptz,
  promoted_by uuid,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.node_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "node_modes super_admin read"
  ON public.node_modes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "node_modes super_admin write"
  ON public.node_modes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- All authenticated users may *read* their own casino's mode (UI badge etc.)
CREATE POLICY "node_modes casino read for own casino"
  ON public.node_modes FOR SELECT TO authenticated
  USING (
    public.user_has_casino_access(auth.uid(), casino_id)
  );

-- ===== Seed cloud_primary for every existing casino =====
INSERT INTO public.node_modes (casino_id, mode)
SELECT id, 'cloud_primary' FROM public.casinos
ON CONFLICT (casino_id) DO NOTHING;

-- Auto-create node_modes row for new casinos
CREATE OR REPLACE FUNCTION public._seed_node_mode_on_casino()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.node_modes (casino_id, mode) VALUES (NEW.id, 'cloud_primary')
  ON CONFLICT (casino_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_node_mode ON public.casinos;
CREATE TRIGGER trg_seed_node_mode
  AFTER INSERT ON public.casinos
  FOR EACH ROW EXECUTE FUNCTION public._seed_node_mode_on_casino();

-- ===== Readiness RPC: does this casino qualify for cutover? =====
CREATE OR REPLACE FUNCTION public.replication_readiness(p_casino_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parity record;
  v_outbox_pending int := 0;
  v_open_day_id uuid;
  v_mode text;
  v_critical_total int := 0;
  v_critical_match int := 0;
  v_lag_seconds numeric := NULL;
  v_summary jsonb;
  v_ready boolean := false;
  v_reasons jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;

  SELECT mode INTO v_mode FROM public.node_modes WHERE casino_id = p_casino_id;
  IF v_mode IS NULL THEN v_mode := 'cloud_primary'; END IF;

  -- latest parity record from mirror_cutover_state
  SELECT * INTO v_parity
    FROM public.mirror_cutover_state
    WHERE casino_id = p_casino_id
    ORDER BY checked_at DESC
    LIMIT 1;

  IF v_parity IS NOT NULL THEN
    v_summary := v_parity.summary;
    v_critical_total := COALESCE((v_summary->>'critical_total')::int, 0);
    v_critical_match := COALESCE((v_summary->>'critical_match')::int, 0);
    v_lag_seconds := EXTRACT(EPOCH FROM (now() - v_parity.checked_at));
  END IF;

  -- outbox backlog
  BEGIN
    SELECT count(*) INTO v_outbox_pending
      FROM public.sync_outbox
      WHERE casino_id = p_casino_id AND delivered_at IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_outbox_pending := 0;
  END;

  -- open business day?
  SELECT id INTO v_open_day_id
    FROM public.business_day_closures
    WHERE casino_id = p_casino_id AND closed_at IS NULL
    ORDER BY business_date DESC LIMIT 1;

  -- Build reasons
  IF v_parity IS NULL THEN
    v_reasons := v_reasons || jsonb_build_object('code','no_parity','msg','No parity check recorded yet');
  ELSIF NOT COALESCE(v_parity.ok, false) THEN
    v_reasons := v_reasons || jsonb_build_object('code','parity_mismatch','msg','Last parity check failed');
  ELSIF v_lag_seconds IS NOT NULL AND v_lag_seconds > 300 THEN
    v_reasons := v_reasons || jsonb_build_object('code','parity_stale','msg','Last parity check is older than 5 min');
  END IF;

  IF v_outbox_pending > 0 THEN
    v_reasons := v_reasons || jsonb_build_object('code','outbox_backlog','msg', v_outbox_pending || ' rows pending in sync outbox');
  END IF;

  IF v_open_day_id IS NOT NULL THEN
    v_reasons := v_reasons || jsonb_build_object('code','open_business_day','msg','Close the open business day first');
  END IF;

  v_ready := (v_parity IS NOT NULL)
         AND COALESCE(v_parity.ok, false)
         AND (v_lag_seconds IS NULL OR v_lag_seconds <= 300)
         AND v_outbox_pending = 0
         AND v_open_day_id IS NULL;

  RETURN jsonb_build_object(
    'ready', v_ready,
    'mode', v_mode,
    'parity', CASE WHEN v_parity IS NULL THEN NULL ELSE jsonb_build_object(
      'ok', v_parity.ok,
      'checked_at', v_parity.checked_at,
      'critical_match', v_critical_match,
      'critical_total', v_critical_total,
      'lag_seconds', v_lag_seconds,
      'summary', v_summary
    ) END,
    'outbox_pending', v_outbox_pending,
    'open_business_day', v_open_day_id,
    'reasons', v_reasons
  );
END;
$$;

-- ===== Promote / Demote RPCs =====
CREATE OR REPLACE FUNCTION public.promote_to_local_primary(p_casino_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_check jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;

  v_check := public.replication_readiness(p_casino_id);
  IF NOT COALESCE((v_check->>'ready')::boolean, false) AND NOT p_force THEN
    RETURN jsonb_build_object('ok', false, 'check', v_check);
  END IF;

  INSERT INTO public.node_modes (casino_id, mode, promoted_at, promoted_by, updated_at)
  VALUES (p_casino_id, 'local_primary', now(), auth.uid(), now())
  ON CONFLICT (casino_id) DO UPDATE
    SET mode = EXCLUDED.mode,
        promoted_at = EXCLUDED.promoted_at,
        promoted_by = EXCLUDED.promoted_by,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'mode', 'local_primary', 'check', v_check);
END;
$$;

CREATE OR REPLACE FUNCTION public.demote_to_cloud_primary(p_casino_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;

  INSERT INTO public.node_modes (casino_id, mode, promoted_at, promoted_by, updated_at)
  VALUES (p_casino_id, 'cloud_primary', now(), auth.uid(), now())
  ON CONFLICT (casino_id) DO UPDATE
    SET mode = EXCLUDED.mode,
        promoted_at = EXCLUDED.promoted_at,
        promoted_by = EXCLUDED.promoted_by,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'mode', 'cloud_primary');
END;
$$;

-- ===== Write-blocking trigger on Cloud =====
-- When casino is local_primary, block direct user writes on operational tables.
-- cms-sync inbox sets `app.sync_applying = '1'` and is allowed through.
CREATE OR REPLACE FUNCTION public._enforce_replication_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino uuid;
  v_mode text;
  v_applying text;
BEGIN
  -- Allow sync inbox writes unconditionally
  BEGIN
    v_applying := current_setting('app.sync_applying', true);
  EXCEPTION WHEN OTHERS THEN v_applying := NULL; END;
  IF v_applying = '1' THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Determine casino_id from row
  IF TG_OP = 'DELETE' THEN
    BEGIN v_casino := OLD.casino_id; EXCEPTION WHEN OTHERS THEN v_casino := NULL; END;
  ELSE
    BEGIN v_casino := NEW.casino_id; EXCEPTION WHEN OTHERS THEN v_casino := NULL; END;
  END IF;

  IF v_casino IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT mode INTO v_mode FROM public.node_modes WHERE casino_id = v_casino;

  -- On the Cloud node (where this trigger lives), block writes when local owns it.
  -- super_admin can still override for emergency fixes.
  IF v_mode = 'local_primary' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Casino % is currently Local-Primary. Direct Cloud writes are blocked. Use the local server.', v_casino
      USING HINT = 'Demote to Cloud-Primary first or perform the action on the local node.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to core operational tables (idempotent)
DO $$
DECLARE
  t text;
  ops text[] := ARRAY[
    'shifts','transactions','casino_visits','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','chip_snapshots','table_tracker',
    'table_daily_results','cash_counts','cash_count_snapshots','cashless_transactions',
    'bank_checks','dealer_attendance','staff_attendance','breaklist','pit_rota',
    'staff_rota','business_day_closures','chip_transfers','player_chip_adjustments',
    'gaming_tables','chip_baseline','chip_inventory'
  ];
BEGIN
  FOREACH t IN ARRAY ops LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_replication_mode ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_replication_mode
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._enforce_replication_mode()', t);
  END LOOP;
END $$;
