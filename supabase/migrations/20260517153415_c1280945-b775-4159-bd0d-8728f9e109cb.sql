-- Fix "column reference is ambiguous" errors in parity/inventory RPCs.
-- The OUT params (table_name, scope) collided with column names from
-- information_schema.columns and sync_table_registry. Add aliases.

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
    SELECT reg.table_name      AS tname,
           reg.scope           AS tscope,
           reg.critical        AS tcritical,
           reg.date_column     AS tdate_column,
           reg.parity_required AS tparity_required
      FROM public.sync_table_registry reg
     WHERE reg.parity_required = true
       AND reg.scope IN ('casino','global','user_system')
     ORDER BY reg.table_name
  LOOP
    IF to_regclass(format('public.%I', r.tname)) IS NULL THEN
      table_name := r.tname; scope := r.tscope; critical := r.tcritical;
      row_count := 0; ids_checksum := NULL; rows_checksum := NULL; max_change_ts := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF r.tscope = 'casino' THEN
      IF r.tname = 'casinos' THEN
        v_filter := format('WHERE id = %L::uuid', p_casino_id);
      ELSE
        v_filter := format('WHERE casino_id = %L::uuid', p_casino_id);
      END IF;
    ELSE
      v_filter := '';
    END IF;

    SELECT EXISTS(SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name=r.tname AND c.column_name='updated_at')
      INTO v_has_uat;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name=r.tname AND c.column_name='created_at')
      INTO v_has_cat;
    v_date_col := COALESCE(
      CASE WHEN v_has_uat THEN 'updated_at' END,
      CASE WHEN v_has_cat THEN 'created_at' END,
      r.tdate_column
    );

    v_sql := format('SELECT count(*) FROM public.%I %s', r.tname, v_filter);
    EXECUTE v_sql INTO v_count;

    BEGIN
      v_sql := format(
        'SELECT md5(coalesce(string_agg(id::text, '','' ORDER BY id::text), '''')) FROM public.%I %s',
        r.tname, v_filter
      );
      EXECUTE v_sql INTO v_ids;
    EXCEPTION WHEN undefined_column THEN
      v_ids := NULL;
    END;

    BEGIN
      v_sql := format(
        'SELECT md5(coalesce(string_agg(rh, '','' ORDER BY rid), '''')) FROM (
           SELECT id::text AS rid, md5(row_to_json(t)::text) AS rh
             FROM public.%I t %s
         ) s',
        r.tname, v_filter
      );
      EXECUTE v_sql INTO v_rows;
    EXCEPTION WHEN undefined_column OR feature_not_supported THEN
      v_rows := NULL;
    END;

    v_max_ts := NULL;
    IF v_date_col IS NOT NULL THEN
      BEGIN
        v_sql := format('SELECT max(%I) FROM public.%I %s', v_date_col, r.tname, v_filter);
        EXECUTE v_sql INTO v_max_ts;
      EXCEPTION WHEN OTHERS THEN
        v_max_ts := NULL;
      END;
    END IF;

    table_name    := r.tname;
    scope         := r.tscope;
    critical      := r.tcritical;
    row_count     := v_count;
    ids_checksum  := v_ids;
    rows_checksum := v_rows;
    max_change_ts := v_max_ts;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.mirror_full_parity_snapshot(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mirror_full_parity_snapshot(uuid) TO authenticated, service_role;

-- ── Inventory RPC: same fix (table_name OUT vs information_schema.columns) ──
CREATE OR REPLACE FUNCTION public.mirror_parity_snapshot(p_casino_id uuid)
RETURNS TABLE(table_name text, row_count bigint, max_updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  upd_col text;
  cnt bigint;
  mx timestamptz;
  tables text[] := ARRAY[
    'players','employees','profiles','user_casino_access',
    'gaming_tables','shifts','chip_inventory','chip_baseline','chip_initial_baseline',
    'chip_snapshots','chip_emissions','chip_transfers','player_chip_adjustments',
    'table_tracker','table_daily_results','business_day_closures','daily_summaries',
    'dealer_attendance','staff_attendance','attendance_hours','attendance_holidays',
    'pit_rota','staff_rota','breaklist',
    'cage_transfers','cash_counts','cash_count_snapshots','cashless_transactions',
    'expenses','transactions','wallet_transactions','financial_wallets',
    'bank_checks','budget_periods','budget_items','budget_categories',
    'casino_visits','client_sessions','player_session_stats','player_session_drops',
    'player_position_history','player_notes','player_economy','player_groups',
    'incidents','cctv_observations',
    'monthly_tips_pools','monthly_tips_entries','weekly_bonus_pools','weekly_bonus_entries',
    'payroll_periods','payroll_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    SELECT c.column_name INTO upd_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t
      AND c.column_name IN ('updated_at','created_at','changed_at','occurred_at','snapshot_at')
    ORDER BY array_position(ARRAY['updated_at','changed_at','occurred_at','snapshot_at','created_at'], c.column_name)
    LIMIT 1;

    BEGIN
      IF upd_col IS NOT NULL THEN
        EXECUTE format(
          'SELECT count(*)::bigint, max(%I) FROM public.%I WHERE casino_id = $1',
          upd_col, t
        ) INTO cnt, mx USING p_casino_id;
      ELSE
        EXECUTE format(
          'SELECT count(*)::bigint, NULL::timestamptz FROM public.%I WHERE casino_id = $1', t
        ) INTO cnt, mx USING p_casino_id;
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      cnt := NULL; mx := NULL;
    END;

    table_name := t;
    row_count := cnt;
    max_updated_at := mx;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mirror_parity_snapshot(uuid) TO authenticated;