
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
    -- detect timestamp column (prefer updated_at, then created_at, then changed_at)
    SELECT column_name INTO upd_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t
      AND column_name IN ('updated_at','created_at','changed_at','occurred_at','snapshot_at')
    ORDER BY array_position(ARRAY['updated_at','changed_at','occurred_at','snapshot_at','created_at'], column_name)
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
