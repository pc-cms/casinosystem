
-- ─────────────────────────────────────────────────────────────
-- 1. Extend sync_capture trigger to all business tables we need
--    in the full mirror (Cases 1 + 2 from the sync mesh plan).
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    -- structural / config
    'casinos','gaming_tables','chip_color_settings',
    'chip_initial_baseline','chip_baseline','chip_inventory','chip_snapshots',
    'financial_wallets','budget_categories','budget_periods','budget_items',
    -- people
    'dealers','staff_members','profiles','user_casino_access','user_module_permissions',
    -- players
    'players','player_cards','player_groups','group_members',
    'player_tags','player_notes',
    -- operational
    'transactions','shifts','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','chip_transfers',
    'casino_visits','breaklist','pit_rota','staff_rota',
    'dealer_attendance','staff_attendance',
    'table_tracker','table_daily_results','business_day_closures',
    'cash_counts','cash_count_snapshots','cashless_transactions',
    'bank_checks','cctv_observations','player_position_history',
    'daily_summaries','inter_casino_transfers','activity_logs','daily_review',
    'blacklist'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      PERFORM public.sync_attach(format('public.%I', t)::regclass);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'sync_attach: table public.% not found, skipping', t;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Idempotency marker for one-time seed backfills.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_seed_marker (
  casino_id    uuid        NOT NULL,
  table_name   text        NOT NULL,
  row_count    integer     NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (casino_id, table_name)
);
ALTER TABLE public.sync_seed_marker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.sync_seed_marker
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "super_admin read" ON public.sync_seed_marker
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill function: copy existing rows for a casino into
--    sync_outbox so the next cms-sync push cycle uploads them.
--    Skips tables already marked completed for this casino.
--    Tables without casino_id column are skipped.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_seed_from_existing(p_casino_id uuid)
RETURNS TABLE(table_name text, inserted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t          text;
  has_casino boolean;
  inserted   integer;
  v_origin   uuid;
  v_pk_col   text;
  v_sql      text;
  tables     text[] := ARRAY[
    'casinos','gaming_tables','chip_color_settings',
    'chip_initial_baseline','chip_baseline','chip_inventory','chip_snapshots',
    'financial_wallets','budget_categories','budget_periods','budget_items',
    'dealers','staff_members','profiles','user_casino_access','user_module_permissions',
    'players','player_cards','player_groups','group_members',
    'player_tags','player_notes',
    'transactions','shifts','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','chip_transfers',
    'casino_visits','breaklist','pit_rota','staff_rota',
    'dealer_attendance','staff_attendance',
    'table_tracker','table_daily_results','business_day_closures',
    'cash_counts','cash_count_snapshots','cashless_transactions',
    'bank_checks','cctv_observations','player_position_history',
    'daily_summaries','inter_casino_transfers','blacklist'
  ];
BEGIN
  IF p_casino_id IS NULL THEN
    RAISE EXCEPTION 'casino_id required';
  END IF;

  SELECT node_id INTO v_origin FROM public.node_identity WHERE id = true;
  IF v_origin IS NULL THEN
    RAISE EXCEPTION 'node_identity not initialised';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- Skip if already seeded for this casino
    IF EXISTS (SELECT 1 FROM public.sync_seed_marker m
               WHERE m.casino_id = p_casino_id AND m.table_name = t) THEN
      CONTINUE;
    END IF;

    -- Skip if table absent
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name = t) THEN
      CONTINUE;
    END IF;

    has_casino := EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema='public' AND table_name = t
                            AND column_name = 'casino_id');

    -- Special-case: casinos table — single row (id = casino_id)
    IF t = 'casinos' THEN
      v_sql := format(
        $f$INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id)
           SELECT $1, %L, 'INSERT',
                  jsonb_build_object('id', to_jsonb(c.id)),
                  to_jsonb(c.*),
                  $2
             FROM public.casinos c
            WHERE c.id = $1$f$, t);
      EXECUTE v_sql USING p_casino_id, v_origin;
      GET DIAGNOSTICS inserted = ROW_COUNT;

    ELSIF has_casino THEN
      v_sql := format(
        $f$INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id)
           SELECT $1, %L, 'INSERT',
                  jsonb_build_object('id', to_jsonb(x.id)),
                  to_jsonb(x.*),
                  $2
             FROM public.%I x
            WHERE x.casino_id = $1$f$, t, t);
      EXECUTE v_sql USING p_casino_id, v_origin;
      GET DIAGNOSTICS inserted = ROW_COUNT;

    ELSE
      -- Tables without casino_id (e.g. profiles, user_casino_access).
      -- For these we filter by membership in user_casino_access for that casino.
      IF t = 'profiles' THEN
        EXECUTE $f$
          INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id)
          SELECT NULL, 'profiles', 'INSERT',
                 jsonb_build_object('id', to_jsonb(p.user_id)),
                 to_jsonb(p.*),
                 $2
            FROM public.profiles p
           WHERE p.casino_id = $1
              OR p.user_id IN (SELECT user_id FROM public.user_casino_access WHERE casino_id = $1)
        $f$ USING p_casino_id, v_origin;
        GET DIAGNOSTICS inserted = ROW_COUNT;
      ELSIF t = 'user_casino_access' THEN
        EXECUTE $f$
          INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id)
          SELECT $1, 'user_casino_access', 'INSERT',
                 jsonb_build_object('id', to_jsonb(u.id)),
                 to_jsonb(u.*),
                 $2
            FROM public.user_casino_access u
           WHERE u.casino_id = $1
        $f$ USING p_casino_id, v_origin;
        GET DIAGNOSTICS inserted = ROW_COUNT;
      ELSE
        inserted := 0;
      END IF;
    END IF;

    INSERT INTO public.sync_seed_marker (casino_id, table_name, row_count, completed_at)
    VALUES (p_casino_id, t, COALESCE(inserted, 0), now())
    ON CONFLICT (casino_id, table_name) DO UPDATE
      SET row_count = EXCLUDED.row_count, completed_at = now();

    table_name := t;
    inserted_count := COALESCE(inserted, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_seed_from_existing(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sync_seed_from_existing(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. Outbox reset (used by Clone-from-Cloud on the local node):
--    clears all unsent outbox rows for a casino and advances every
--    peer's last_push_cursor to MAX(id) so the freshly-imported
--    rows are never echoed back to the peer they came from.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reset_outbox(p_casino_id uuid, p_advance_cursors boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
  v_max_id  bigint;
BEGIN
  IF p_casino_id IS NULL THEN
    RAISE EXCEPTION 'casino_id required';
  END IF;

  DELETE FROM public.sync_outbox
   WHERE casino_id = p_casino_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.sync_seed_marker
   WHERE casino_id = p_casino_id;

  IF p_advance_cursors THEN
    SELECT COALESCE(MAX(id), 0) INTO v_max_id FROM public.sync_outbox;
    UPDATE public.peer_links
       SET last_push_cursor = GREATEST(last_push_cursor, v_max_id);
  END IF;

  RETURN jsonb_build_object(
    'deleted_outbox_rows', v_deleted,
    'advanced_cursor_to', COALESCE(v_max_id, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_reset_outbox(uuid, boolean) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sync_reset_outbox(uuid, boolean) TO service_role;
