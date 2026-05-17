CREATE OR REPLACE FUNCTION public.sync_wipe_casino_data(
  p_casino_id   uuid,
  p_confirm_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t        text;
  v_slug   text;
  v_count  bigint;
  v_total  bigint := 0;
  v_per_table jsonb := '{}'::jsonb;
  -- Operational/transactional tables only. Structural config
  -- (casinos, chip_color_settings, financial_wallets, budget_categories,
  --  gaming_tables, chip_inventory, chip_baseline, chip_initial_baseline)
  -- is preserved so the casino keeps its identity & chip setup.
  tables text[] := ARRAY[
    'transactions','shifts','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','chip_transfers','chip_snapshots',
    'casino_visits','breaklist','pit_rota','staff_rota',
    'dealer_attendance','staff_attendance',
    'table_tracker','table_daily_results','business_day_closures',
    'cash_counts','cash_count_snapshots','cashless_transactions',
    'bank_checks','cctv_observations','player_position_history',
    'daily_summaries','inter_casino_transfers','activity_logs','daily_review',
    'players','player_cards','player_groups','group_members',
    'player_tags','player_notes','blacklist'
  ];
BEGIN
  IF p_casino_id IS NULL THEN
    RAISE EXCEPTION 'casino_id required';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'super_admin role required';
  END IF;

  SELECT slug INTO v_slug FROM public.casinos WHERE id = p_casino_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'casino not found';
  END IF;

  IF lower(coalesce(p_confirm_slug,'')) <> lower(v_slug) THEN
    RAISE EXCEPTION 'confirmation slug mismatch (expected: %)', v_slug;
  END IF;

  -- Suppress outbox capture during wipe so we don't spam peers with deletes.
  -- Local Primary will overwrite via sync_seed_from_existing afterwards.
  PERFORM set_config('sync.applying','on', true);

  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'DELETE FROM public.%I WHERE casino_id = $1',
        t
      ) USING p_casino_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_per_table := v_per_table || jsonb_build_object(t, v_count);
        v_total := v_total + v_count;
      END IF;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END LOOP;

  -- Clear pending outbox + seed markers for this casino.
  DELETE FROM public.sync_outbox      WHERE casino_id = p_casino_id;
  DELETE FROM public.sync_seed_marker WHERE casino_id = p_casino_id;

  RETURN jsonb_build_object(
    'casino_id',   p_casino_id,
    'casino_slug', v_slug,
    'total_rows_deleted', v_total,
    'per_table', v_per_table
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_wipe_casino_data(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.sync_wipe_casino_data(uuid, text) TO authenticated, service_role;