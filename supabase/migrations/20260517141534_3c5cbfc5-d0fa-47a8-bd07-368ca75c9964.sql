-- ─────────────────────────────────────────────────────────────
-- 1. Single source of truth: which tables must be mirrored.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_table_registry (
  table_name      text PRIMARY KEY,
  scope           text NOT NULL CHECK (scope IN ('casino','global','user_system','runtime_excluded')),
  critical        boolean NOT NULL DEFAULT true,
  parity_required boolean NOT NULL DEFAULT true,
  date_column     text,
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_table_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "registry read auth" ON public.sync_table_registry
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "registry write super_admin" ON public.sync_table_registry
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'super_admin'))
    WITH CHECK (public.has_role(auth.uid(),'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed registry. Re-runnable.
INSERT INTO public.sync_table_registry (table_name, scope, critical, parity_required, date_column, notes) VALUES
  -- Config / structural (casino-scoped)
  ('casinos','global',true,true,NULL,'Single row per casino'),
  ('gaming_tables','casino',true,true,NULL,NULL),
  ('chip_color_settings','casino',true,true,NULL,NULL),
  ('chip_initial_baseline','casino',true,true,NULL,NULL),
  ('chip_baseline','casino',true,true,NULL,NULL),
  ('chip_inventory','casino',true,true,NULL,NULL),
  ('financial_wallets','casino',true,true,NULL,NULL),
  ('budget_categories','casino',true,true,NULL,NULL),
  ('budget_periods','casino',true,true,NULL,NULL),
  ('budget_items','casino',true,true,NULL,NULL),
  ('budget_logs','casino',false,true,'created_at',NULL),
  -- People
  ('dealers','casino',true,true,NULL,NULL),
  ('staff_members','casino',true,true,NULL,NULL),
  ('employees','casino',true,true,NULL,NULL),
  ('employee_bank_accounts','global',false,true,NULL,'FK to employees'),
  -- Players
  ('players','casino',true,true,NULL,NULL),
  ('player_cards','global',true,true,NULL,'FK to players'),
  ('player_groups','casino',true,true,NULL,NULL),
  ('group_members','global',true,true,NULL,'FK to player_groups'),
  ('player_tags','global',true,true,NULL,'FK to players'),
  ('player_notes','casino',true,true,'created_at',NULL),
  ('player_chip_adjustments','casino',true,true,'created_at',NULL),
  ('player_position_history','casino',false,true,'changed_at',NULL),
  ('blacklist','global',true,true,NULL,NULL),
  -- Users & roles & permissions
  ('profiles','casino',true,true,NULL,'casino_id present'),
  ('user_roles','user_system',true,true,NULL,'CRITICAL: roles'),
  ('user_credentials','user_system',true,true,NULL,NULL),
  ('user_casino_access','casino',true,true,NULL,NULL),
  ('user_module_permissions','global',true,true,NULL,NULL),
  ('role_module_defaults','global',true,true,NULL,NULL),
  -- Operational
  ('shifts','casino',true,true,'created_at',NULL),
  ('transactions','casino',true,true,'created_at',NULL),
  ('cage_transfers','casino',true,true,'created_at',NULL),
  ('expenses','casino',true,true,'business_date',NULL),
  ('wallet_transactions','casino',true,true,'created_at',NULL),
  ('chip_emissions','casino',true,true,'created_at',NULL),
  ('chip_transfers','casino',false,true,'created_at','Deprecated UI but still synced'),
  ('chip_snapshots','casino',true,true,'created_at',NULL),
  ('casino_visits','casino',true,true,'created_at',NULL),
  ('breaklist','casino',true,true,'business_date',NULL),
  ('breaklist_logs','casino',false,true,'created_at',NULL),
  ('pit_rota','casino',true,true,'rota_date',NULL),
  ('staff_rota','casino',true,true,'rota_date',NULL),
  ('dealer_attendance','casino',true,true,'business_date',NULL),
  ('staff_attendance','casino',true,true,'business_date',NULL),
  ('attendance_hours','casino',true,true,NULL,NULL),
  ('attendance_holidays','casino',true,true,NULL,NULL),
  ('table_tracker','casino',true,true,'business_date',NULL),
  ('table_daily_results','casino',true,true,'business_date',NULL),
  ('business_day_closures','casino',true,true,'business_date',NULL),
  ('cash_counts','casino',true,true,'business_date',NULL),
  ('cash_count_snapshots','casino',true,true,'created_at',NULL),
  ('cashless_transactions','casino',true,true,'created_at',NULL),
  ('bank_checks','casino',true,true,'created_at',NULL),
  ('cctv_observations','casino',true,true,'created_at',NULL),
  ('daily_summaries','casino',true,true,'business_date',NULL),
  ('daily_review','casino',true,true,NULL,NULL),
  ('inter_casino_transfers','global',true,true,'created_at',NULL),
  ('incidents','casino',true,true,NULL,NULL),
  ('incidents_audit','casino',false,false,NULL,'Audit log, not required for cutover'),
  ('client_sessions','casino',true,true,NULL,NULL),
  ('activity_logs','casino',false,false,'created_at','High volume audit, not required for cutover'),
  -- Payroll
  ('payroll_settings','casino',true,true,NULL,NULL),
  ('payroll_periods','casino',true,true,NULL,NULL),
  ('payroll_entries','casino',true,true,NULL,NULL),
  ('payroll_paye_brackets','casino',true,true,NULL,NULL),
  ('payroll_audit_log','casino',false,false,NULL,NULL),
  ('tax_brackets','global',true,true,NULL,NULL),
  -- Bonus / tips
  ('weekly_bonus_pools','casino',true,true,NULL,NULL),
  ('weekly_bonus_entries','casino',true,true,NULL,NULL),
  ('monthly_tips_pools','casino',true,true,NULL,NULL),
  ('monthly_tips_entries','casino',true,true,NULL,NULL),
  -- Runtime / sync (excluded from parity)
  ('sync_outbox','runtime_excluded',false,false,NULL,'local-only state'),
  ('sync_inbox_log','runtime_excluded',false,false,NULL,'local-only state'),
  ('sync_seed_marker','runtime_excluded',false,false,NULL,'local-only state'),
  ('sync_snapshot_state','runtime_excluded',false,false,NULL,'local-only state'),
  ('sync_peer_health','runtime_excluded',false,false,NULL,NULL),
  ('sync_apply_errors','runtime_excluded',false,false,NULL,NULL),
  ('sync_probe_events','runtime_excluded',false,false,NULL,NULL),
  ('sync_probes','runtime_excluded',false,false,NULL,NULL),
  ('sync_exchange_logs','runtime_excluded',false,false,NULL,NULL),
  ('sync_table_registry','runtime_excluded',false,false,NULL,'self'),
  ('peer_links','runtime_excluded',false,false,NULL,'peer config'),
  ('peer_bootstrap_tokens','runtime_excluded',false,false,NULL,NULL),
  ('pending_server_registrations','runtime_excluded',false,false,NULL,NULL),
  ('node_identity','runtime_excluded',false,false,NULL,'per-node identity'),
  ('node_commands','runtime_excluded',false,false,NULL,NULL),
  ('update_commands','runtime_excluded',false,false,NULL,NULL),
  ('cloud_connection','runtime_excluded',false,false,NULL,NULL),
  ('casino_servers','runtime_excluded',false,false,NULL,NULL),
  ('initial_sync_jobs','runtime_excluded',false,false,NULL,NULL),
  ('system_locks','runtime_excluded',false,false,NULL,NULL),
  ('cron_run_log','runtime_excluded',false,false,NULL,NULL),
  ('tag_conflicts','runtime_excluded',false,false,NULL,NULL),
  ('mirror_cutover_state','runtime_excluded',false,false,NULL,NULL),
  -- Archives
  ('activity_logs_archive','runtime_excluded',false,false,NULL,NULL),
  ('breaklist_logs_archive','runtime_excluded',false,false,NULL,NULL),
  ('client_sessions_archive','runtime_excluded',false,false,NULL,NULL),
  ('casino_visits_archive','runtime_excluded',false,false,NULL,NULL)
ON CONFLICT (table_name) DO UPDATE SET
  scope = EXCLUDED.scope,
  critical = EXCLUDED.critical,
  parity_required = EXCLUDED.parity_required,
  date_column = EXCLUDED.date_column,
  notes = EXCLUDED.notes,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────
-- 2. Cutover state per casino
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mirror_cutover_state (
  casino_id              uuid PRIMARY KEY,
  write_freeze           boolean NOT NULL DEFAULT false,
  freeze_started_at      timestamptz,
  freeze_started_by      uuid,
  last_parity_at         timestamptz,
  last_parity_ok         boolean,
  last_parity_summary    jsonb,
  promoted_to_local_at   timestamptz,
  promoted_by            uuid,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mirror_cutover_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cutover read auth" ON public.mirror_cutover_state
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cutover write super_admin" ON public.mirror_cutover_state
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'super_admin'))
    WITH CHECK (public.has_role(auth.uid(),'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Parity snapshot RPC
--    For each registered, parity_required table:
--      row_count, ids_checksum, rows_checksum, max_change_ts
--    Scope filter:
--      casino: where casino_id = p_casino_id
--      global: all rows (small / shared tables)
--      user_system: all rows
--    Skips runtime_excluded.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mirror_full_parity_snapshot(p_casino_id uuid)
RETURNS TABLE(
  table_name       text,
  scope            text,
  critical         boolean,
  row_count        bigint,
  ids_checksum     text,
  rows_checksum    text,
  max_change_ts    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_sql      text;
  v_filter   text;
  v_count    bigint;
  v_ids      text;
  v_rows     text;
  v_max_ts   timestamptz;
  v_has_uat  boolean;
  v_has_cat  boolean;
  v_date_col text;
BEGIN
  IF p_casino_id IS NULL THEN
    RAISE EXCEPTION 'casino_id required';
  END IF;

  FOR r IN
    SELECT * FROM public.sync_table_registry
     WHERE parity_required = true
       AND scope IN ('casino','global','user_system')
     ORDER BY table_name
  LOOP
    -- Skip if table absent on this node
    IF to_regclass(format('public.%I', r.table_name)) IS NULL THEN
      table_name := r.table_name; scope := r.scope; critical := r.critical;
      row_count := 0; ids_checksum := NULL; rows_checksum := NULL; max_change_ts := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Build scope filter
    IF r.scope = 'casino' THEN
      IF r.table_name = 'casinos' THEN
        v_filter := format('WHERE id = %L::uuid', p_casino_id);
      ELSE
        v_filter := format('WHERE casino_id = %L::uuid', p_casino_id);
      END IF;
    ELSE
      v_filter := '';
    END IF;

    -- Detect timestamp columns for max_change_ts
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=r.table_name AND column_name='updated_at')
      INTO v_has_uat;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=r.table_name AND column_name='created_at')
      INTO v_has_cat;
    v_date_col := COALESCE(
      CASE WHEN v_has_uat THEN 'updated_at' END,
      CASE WHEN v_has_cat THEN 'created_at' END,
      r.date_column
    );

    -- Count
    v_sql := format('SELECT count(*) FROM public.%I %s', r.table_name, v_filter);
    EXECUTE v_sql INTO v_count;

    -- IDs checksum (md5 of sorted id list)
    BEGIN
      v_sql := format(
        'SELECT md5(coalesce(string_agg(id::text, '','' ORDER BY id::text), '''')) FROM public.%I %s',
        r.table_name, v_filter
      );
      EXECUTE v_sql INTO v_ids;
    EXCEPTION WHEN undefined_column THEN
      v_ids := NULL;
    END;

    -- Rows checksum (md5 of md5(row_to_json) sorted by id)
    BEGIN
      v_sql := format(
        'SELECT md5(coalesce(string_agg(rh, '','' ORDER BY rid), '''')) FROM (
           SELECT id::text AS rid, md5(row_to_json(t)::text) AS rh
             FROM public.%I t %s
         ) s',
        r.table_name, v_filter
      );
      EXECUTE v_sql INTO v_rows;
    EXCEPTION WHEN undefined_column OR feature_not_supported THEN
      v_rows := NULL;
    END;

    -- Max change timestamp
    v_max_ts := NULL;
    IF v_date_col IS NOT NULL THEN
      BEGIN
        v_sql := format('SELECT max(%I) FROM public.%I %s', v_date_col, r.table_name, v_filter);
        EXECUTE v_sql INTO v_max_ts;
      EXCEPTION WHEN OTHERS THEN
        v_max_ts := NULL;
      END;
    END IF;

    table_name    := r.table_name;
    scope         := r.scope;
    critical      := r.critical;
    row_count     := v_count;
    ids_checksum  := v_ids;
    rows_checksum := v_rows;
    max_change_ts := v_max_ts;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.mirror_full_parity_snapshot(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mirror_full_parity_snapshot(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. Freeze / unfreeze writes
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mirror_freeze_writes(p_casino_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;
  INSERT INTO public.mirror_cutover_state(casino_id, write_freeze, freeze_started_at, freeze_started_by, updated_at)
  VALUES (p_casino_id, true, now(), auth.uid(), now())
  ON CONFLICT (casino_id) DO UPDATE SET
    write_freeze = true,
    freeze_started_at = now(),
    freeze_started_by = auth.uid(),
    updated_at = now();
  RETURN jsonb_build_object('ok', true, 'frozen_at', now());
END $$;

CREATE OR REPLACE FUNCTION public.mirror_unfreeze_writes(p_casino_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;
  UPDATE public.mirror_cutover_state
     SET write_freeze = false,
         freeze_started_at = NULL,
         freeze_started_by = NULL,
         updated_at = now()
   WHERE casino_id = p_casino_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.mirror_record_parity(
  p_casino_id uuid,
  p_ok        boolean,
  p_summary   jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.mirror_cutover_state(casino_id, last_parity_at, last_parity_ok, last_parity_summary, updated_at)
  VALUES (p_casino_id, now(), p_ok, p_summary, now())
  ON CONFLICT (casino_id) DO UPDATE SET
    last_parity_at = now(),
    last_parity_ok = p_ok,
    last_parity_summary = p_summary,
    updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.mirror_freeze_writes(uuid)   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mirror_unfreeze_writes(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mirror_record_parity(uuid,boolean,jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mirror_freeze_writes(uuid)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mirror_unfreeze_writes(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mirror_record_parity(uuid,boolean,jsonb) TO authenticated, service_role;