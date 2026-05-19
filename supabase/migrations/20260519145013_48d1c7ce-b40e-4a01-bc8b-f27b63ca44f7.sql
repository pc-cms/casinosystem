
CREATE OR REPLACE FUNCTION public.clone_arusha_to_mbeya_demo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_arusha uuid := '48f4404f-7724-418c-8365-29af3998e113';
  v_mbeya  uuid := '7ab2eee1-5253-45db-a53b-4a25e72f747e';
  v_op     uuid;
  v_players int := 0; v_shifts int := 0; v_tx int := 0;
  v_exp int := 0; v_tr int := 0; v_cs int := 0; v_tt int := 0;
  v_vis int := 0; v_bdc int := 0;
BEGIN
  SELECT id INTO v_op FROM auth.users WHERE email = 'pasha@demo.local';
  IF v_op IS NULL THEN RAISE EXCEPTION 'Pasha user not found'; END IF;
  SET LOCAL session_replication_role = 'replica';

  CREATE TEMP TABLE tbl_map ON COMMIT DROP AS
  SELECT a.id AS a_id, m.id AS m_id
  FROM gaming_tables a
  JOIN gaming_tables m ON m.name = a.name AND m.casino_id = v_mbeya
  WHERE a.casino_id = v_arusha;

  CREATE TEMP TABLE shift_src ON COMMIT DROP AS
  SELECT * FROM shifts
  WHERE casino_id = v_arusha AND status = 'closed'
  ORDER BY opened_at DESC LIMIT 10;

  CREATE TEMP TABLE player_map (a_id uuid PRIMARY KEY, m_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO player_map (a_id, m_id)
  SELECT a_id, gen_random_uuid() FROM (
    SELECT DISTINCT t.player_id AS a_id
    FROM transactions t
    WHERE t.shift_id IN (SELECT id FROM shift_src) AND t.player_id IS NOT NULL
  ) d;

  INSERT INTO players (id, casino_id, first_name, last_name, nickname, phone,
                       status, player_type, id_number, category, birth_date,
                       created_at, updated_at)
  SELECT pm.m_id, v_mbeya, p.first_name, p.last_name,
         p.nickname || ' (demo)', p.phone || '-d' || substr(pm.m_id::text,1,4),
         p.status, p.player_type,
         p.id_number || '-D' || substr(pm.m_id::text,1,4),
         p.category, p.birth_date, p.created_at, p.updated_at
  FROM player_map pm JOIN players p ON p.id = pm.a_id;
  GET DIAGNOSTICS v_players = ROW_COUNT;
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'players', m_id, v_mbeya FROM player_map;

  INSERT INTO player_tags (id, player_id, tag, source)
  SELECT gen_random_uuid(), m_id, 'demo', 'floor' FROM player_map;

  CREATE TEMP TABLE shift_map (a_id uuid PRIMARY KEY, m_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO shift_map (a_id, m_id)
  SELECT id, gen_random_uuid() FROM shift_src;

  INSERT INTO shifts (id, casino_id, opened_at, closed_at, opened_by, closed_by,
                      status, exchange_rates, opening_float, closing_count, closing_cash,
                      notes, created_at, cash_result, miss_total, shift_result,
                      tables_result, cash_desk_result, balance)
  SELECT sm.m_id, v_mbeya, s.opened_at, s.closed_at, v_op, v_op,
         s.status, s.exchange_rates, s.opening_float, s.closing_count, s.closing_cash,
         COALESCE(s.notes,'') || ' [demo]', s.created_at,
         s.cash_result, s.miss_total, s.shift_result,
         s.tables_result, s.cash_desk_result, s.balance
  FROM shift_map sm JOIN shift_src s ON s.id = sm.a_id;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'shifts', m_id, v_mbeya FROM shift_map;

  WITH ins AS (
    INSERT INTO transactions (id, casino_id, player_id, table_id, type, amount, chips,
                              operator_id, created_at, shift_id, business_date)
    SELECT gen_random_uuid(), v_mbeya, pm.m_id, tm.m_id, t.type, t.amount, t.chips,
           v_op, t.created_at, sm.m_id, t.business_date
    FROM transactions t
    JOIN shift_map sm ON sm.a_id = t.shift_id
    JOIN player_map pm ON pm.a_id = t.player_id
    LEFT JOIN tbl_map tm ON tm.a_id = t.table_id
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'transactions', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_tx = ROW_COUNT;

  WITH ins AS (
    INSERT INTO expenses (id, casino_id, category, amount, description, player_id,
                          approved, approved_by, approved_at, created_by, created_at,
                          shift_id, player_name, business_date)
    SELECT gen_random_uuid(), v_mbeya, e.category, e.amount, e.description || ' [demo]',
           pm.m_id, true, v_op, e.approved_at, v_op, e.created_at,
           sm.m_id, e.player_name, e.business_date
    FROM expenses e
    JOIN shift_map sm ON sm.a_id = e.shift_id
    LEFT JOIN player_map pm ON pm.a_id = e.player_id
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'expenses', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_exp = ROW_COUNT;

  WITH ins AS (
    INSERT INTO cage_transfers (id, casino_id, shift_id, transfer_type, direction,
                                table_id, amount, chips, note, operator_id, approved_by, created_at)
    SELECT gen_random_uuid(), v_mbeya, sm.m_id, c.transfer_type, c.direction,
           tm.m_id, c.amount, c.chips, COALESCE(c.note,'') || ' [demo]', v_op, v_op, c.created_at
    FROM cage_transfers c
    JOIN shift_map sm ON sm.a_id = c.shift_id
    LEFT JOIN tbl_map tm ON tm.a_id = c.table_id
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'cage_transfers', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_tr = ROW_COUNT;

  WITH date_range AS (
    SELECT MIN(opened_at::date) AS dmin, MAX(closed_at::date) AS dmax FROM shift_src
  ),
  ins AS (
    INSERT INTO chip_snapshots (id, casino_id, date, location_type, location_id,
                                denomination, expected_quantity, actual_quantity, miss,
                                recorded_by, created_at)
    SELECT gen_random_uuid(), v_mbeya, cs.date, cs.location_type,
           CASE WHEN cs.location_type = 'table' THEN tm.m_id ELSE cs.location_id END,
           cs.denomination, cs.expected_quantity, cs.actual_quantity, cs.miss,
           v_op, cs.created_at
    FROM chip_snapshots cs
    CROSS JOIN date_range dr
    LEFT JOIN tbl_map tm ON tm.a_id = cs.location_id
    WHERE cs.casino_id = v_arusha
      AND cs.date BETWEEN dr.dmin AND dr.dmax
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'chip_snapshots', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_cs = ROW_COUNT;

  WITH date_range AS (
    SELECT MIN(opened_at::date) AS dmin, MAX(closed_at::date) AS dmax FROM shift_src
  ),
  ins AS (
    INSERT INTO table_tracker (id, casino_id, table_id, date, time_slot, value, recorded_by, created_at)
    SELECT gen_random_uuid(), v_mbeya, tm.m_id, tt.date, tt.time_slot, tt.value, v_op, tt.created_at
    FROM table_tracker tt
    CROSS JOIN date_range dr
    JOIN tbl_map tm ON tm.a_id = tt.table_id
    WHERE tt.casino_id = v_arusha
      AND tt.date BETWEEN dr.dmin AND dr.dmax
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'table_tracker', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_tt = ROW_COUNT;

  WITH ins AS (
    INSERT INTO casino_visits (id, casino_id, player_id, date, checked_in_at,
                               checked_in_by, checked_out_at, position)
    SELECT gen_random_uuid(), v_mbeya, pm.m_id, v.date, v.checked_in_at,
           v_op, v.checked_out_at, v.position
    FROM casino_visits v
    JOIN player_map pm ON pm.a_id = v.player_id
    WHERE v.casino_id = v_arusha
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'casino_visits', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_vis = ROW_COUNT;

  WITH date_range AS (
    SELECT MIN(opened_at::date) AS dmin, MAX(closed_at::date) AS dmax FROM shift_src
  ),
  ins AS (
    INSERT INTO business_day_closures (id, casino_id, business_date, closed_at,
                                       closed_by, closed_method, snapshot)
    SELECT gen_random_uuid(), v_mbeya, b.business_date, b.closed_at,
           v_op, 'demo', b.snapshot
    FROM business_day_closures b
    CROSS JOIN date_range dr
    WHERE b.casino_id = v_arusha
      AND b.business_date BETWEEN dr.dmin AND dr.dmax
    RETURNING id
  )
  INSERT INTO demo_seed_log (table_name, row_id, casino_id)
  SELECT 'business_day_closures', id, v_mbeya FROM ins;
  GET DIAGNOSTICS v_bdc = ROW_COUNT;

  RETURN jsonb_build_object(
    'players', v_players, 'shifts', v_shifts, 'transactions', v_tx,
    'expenses', v_exp, 'cage_transfers', v_tr, 'chip_snapshots', v_cs,
    'table_tracker', v_tt, 'visits', v_vis, 'business_day_closures', v_bdc
  );
END $$;
