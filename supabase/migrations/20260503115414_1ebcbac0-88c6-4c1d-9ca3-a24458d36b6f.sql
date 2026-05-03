-- ============================================================
-- 1. Расширенный сборщик снапшота бизнес-дня
-- ============================================================
CREATE OR REPLACE FUNCTION public.build_business_day_snapshot(_casino_id uuid, _business_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
BEGIN
  -- Cash counts (со всеми номиналами)
  result := jsonb_set(result, '{cash_counts}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cash_count_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.created_at::date = _business_date
  ), '[]'::jsonb));

  -- Expenses
  result := jsonb_set(result, '{expenses}', COALESCE((
    SELECT jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at)
    FROM expenses e
    WHERE e.casino_id = _casino_id
      AND e.business_date = _business_date
  ), '[]'::jsonb));

  -- Cashless transactions
  result := jsonb_set(result, '{cashless}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM cashless_transactions c
    WHERE c.casino_id = _casino_id
      AND c.business_date = _business_date
  ), '[]'::jsonb));

  -- Pit Table Tracker (Table Check)
  result := jsonb_set(result, '{table_tracker}', COALESCE((
    SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.time_slot)
    FROM table_tracker t
    WHERE t.casino_id = _casino_id
      AND t.date = _business_date
  ), '[]'::jsonb));

  -- Pit Chip Snapshots (Table Chips Count)
  result := jsonb_set(result, '{chip_snapshots}', COALESCE((
    SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at)
    FROM chip_snapshots c
    WHERE c.casino_id = _casino_id
      AND c.date = _business_date
  ), '[]'::jsonb));

  -- Pit Breaklist
  result := jsonb_set(result, '{breaklist}', COALESCE((
    SELECT jsonb_agg(to_jsonb(b.*) ORDER BY b.time_slot, b.dealer_id)
    FROM breaklist b
    WHERE b.casino_id = _casino_id
      AND b.date = _business_date
  ), '[]'::jsonb));

  -- Pit Player Statistics — client_sessions за день
  result := jsonb_set(result, '{player_stats}', COALESCE((
    SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.started_at)
    FROM client_sessions s
    WHERE s.casino_id = _casino_id
      AND s.started_at::date = _business_date
  ), '[]'::jsonb));

  RETURN result;
END;
$$;

-- ============================================================
-- 2. Обновляем close_business_day чтобы писал полный снапшот
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_business_day(_casino_id uuid, _method text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_existing business_day_closures%ROWTYPE;
  v_snapshot jsonb;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  v_today := public.get_current_business_date(_casino_id);

  -- Авторизация: только manager/super_admin/system (auto)
  IF _method = 'manual' THEN
    IF NOT (public.has_role(v_user, 'manager'::app_role)
         OR public.has_role(v_user, 'pit'::app_role)
         OR public.has_role(v_user, 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'Insufficient privileges to close business day';
    END IF;
  END IF;

  -- Идемпотентность
  SELECT * INTO v_existing
  FROM business_day_closures
  WHERE casino_id = _casino_id AND business_date = v_today;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_closed', 'business_date', v_today);
  END IF;

  v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);

  INSERT INTO business_day_closures (casino_id, business_date, closed_method, closed_by, snapshot)
  VALUES (_casino_id, v_today, _method, v_user, v_snapshot);

  RETURN jsonb_build_object('status', 'closed', 'business_date', v_today);
END;
$$;

-- ============================================================
-- 3. RPC: редактирование снапшота закрытого дня + аудит
-- ============================================================
CREATE OR REPLACE FUNCTION public.edit_business_day_snapshot(
  _closure_id uuid,
  _section text,
  _patches jsonb  -- массив { row_index, field, before, after }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closure business_day_closures%ROWTYPE;
  v_user uuid;
  v_is_manager boolean;
  v_is_finance boolean;
  v_is_super boolean;
  v_snapshot jsonb;
  v_section_data jsonb;
  v_patch jsonb;
  v_row_index int;
  v_field text;
  v_before jsonb;
  v_after jsonb;
  v_changes_count int := 0;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_manager := public.has_role(v_user, 'manager'::app_role);
  v_is_finance := public.has_role(v_user, 'finance_manager'::app_role);
  v_is_super   := public.has_role(v_user, 'super_admin'::app_role);

  IF NOT (v_is_manager OR v_is_finance OR v_is_super) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  -- Section ACL
  IF _section IN ('cash_counts', 'expenses', 'cashless') THEN
    IF NOT (v_is_finance OR v_is_super) THEN
      RAISE EXCEPTION 'Only Finance Manager or Super Admin can edit financial sections';
    END IF;
  ELSIF _section IN ('table_tracker', 'chip_snapshots', 'breaklist', 'player_stats') THEN
    IF NOT (v_is_manager OR v_is_super) THEN
      RAISE EXCEPTION 'Only Manager or Super Admin can edit Pit sections';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown section: %', _section;
  END IF;

  SELECT * INTO v_closure FROM business_day_closures WHERE id = _closure_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Closure not found';
  END IF;

  -- Casino access for non-super
  IF NOT v_is_super AND v_closure.casino_id <> public.get_user_casino_id(v_user) THEN
    RAISE EXCEPTION 'Casino access denied';
  END IF;

  v_snapshot := COALESCE(v_closure.snapshot, '{}'::jsonb);
  v_section_data := COALESCE(v_snapshot -> _section, '[]'::jsonb);

  -- Apply patches
  FOR v_patch IN SELECT * FROM jsonb_array_elements(_patches)
  LOOP
    v_row_index := (v_patch ->> 'row_index')::int;
    v_field := v_patch ->> 'field';
    v_before := v_patch -> 'before';
    v_after := v_patch -> 'after';

    -- Mutate JSONB array
    v_section_data := jsonb_set(
      v_section_data,
      ARRAY[v_row_index::text, v_field],
      v_after,
      true
    );

    -- Audit row per field
    INSERT INTO activity_logs (casino_id, category, action, operator_id, details)
    VALUES (
      v_closure.casino_id,
      'edit'::log_category,
      'business_day_field_edit',
      v_user,
      jsonb_build_object(
        'closure_id', _closure_id,
        'business_date', v_closure.business_date,
        'section', _section,
        'row_index', v_row_index,
        'field', v_field,
        'before', v_before,
        'after', v_after
      )
    );

    v_changes_count := v_changes_count + 1;
  END LOOP;

  v_snapshot := jsonb_set(v_snapshot, ARRAY[_section], v_section_data, true);

  UPDATE business_day_closures
  SET snapshot = v_snapshot
  WHERE id = _closure_id;

  RETURN jsonb_build_object('status', 'ok', 'changes', v_changes_count);
END;
$$;

-- ============================================================
-- 4. Allow UPDATE on business_day_closures (only via SECURITY DEFINER RPC)
-- ============================================================
-- Никаких прямых UPDATE/INSERT/DELETE для пользователей. RPC использует SECURITY DEFINER.

GRANT EXECUTE ON FUNCTION public.edit_business_day_snapshot(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_business_day_snapshot(uuid, date) TO authenticated;