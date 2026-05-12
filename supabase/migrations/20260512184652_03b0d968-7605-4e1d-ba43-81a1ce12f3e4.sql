-- 1) Helper: operational manager check (manager OR floor_manager OR super_admin)
CREATE OR REPLACE FUNCTION public.is_manager_op(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('manager','floor_manager','super_admin')
  );
$$;

-- 2) Swap RLS policies on operational tables.
-- Pattern: DROP existing manager-gated policy, recreate with is_manager_op().

-- breaklist
DROP POLICY IF EXISTS "Pit managers insert breaklist" ON public.breaklist;
CREATE POLICY "Pit managers insert breaklist" ON public.breaklist
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Breaklist update policy" ON public.breaklist;
CREATE POLICY "Breaklist update policy" ON public.breaklist
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (((NOT is_locked) AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())))
              OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "System deletes breaklist on shift" ON public.breaklist;
CREATE POLICY "System deletes breaklist on shift" ON public.breaklist
  FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- cashless_transactions
DROP POLICY IF EXISTS "Cashier/manager insert cashless" ON public.cashless_transactions;
CREATE POLICY "Cashier/manager insert cashless" ON public.cashless_transactions
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND operator_id = auth.uid()
              AND (public.has_role(auth.uid(), 'cashier'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Casino cash/manager see cashless" ON public.cashless_transactions;
CREATE POLICY "Casino cash/manager see cashless" ON public.cashless_transactions
  FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'cashier'::app_role)
              OR public.is_manager_op(auth.uid())
              OR public.has_role(auth.uid(), 'finance_manager'::app_role)));

DROP POLICY IF EXISTS "Manager approves cashless" ON public.cashless_transactions;
CREATE POLICY "Manager approves cashless" ON public.cashless_transactions
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.is_manager_op(auth.uid()) OR public.has_role(auth.uid(), 'finance_manager'::app_role)));

-- cctv_observations
DROP POLICY IF EXISTS "Managers see casino observations" ON public.cctv_observations;
CREATE POLICY "Managers see casino observations" ON public.cctv_observations
  FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Pit/Manager acknowledge observations" ON public.cctv_observations;
CREATE POLICY "Pit/Manager acknowledge observations" ON public.cctv_observations
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())))
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- expenses (the headline fix: Floor Manager can approve & delete)
DROP POLICY IF EXISTS "Authorized roles create expenses" ON public.expenses;
CREATE POLICY "Authorized roles create expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND created_by = auth.uid()
              AND (public.has_role(auth.uid(), 'cashier'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Managers approve expenses" ON public.expenses;
CREATE POLICY "Managers approve expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers delete expenses" ON public.expenses;
CREATE POLICY "Managers delete expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- gaming_tables
DROP POLICY IF EXISTS "Authorized users update tables" ON public.gaming_tables;
CREATE POLICY "Authorized users update tables" ON public.gaming_tables
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.is_manager_op(auth.uid())
              OR public.has_role(auth.uid(), 'pit'::app_role)
              OR public.has_role(auth.uid(), 'cashier'::app_role)));

DROP POLICY IF EXISTS "Managers insert tables" ON public.gaming_tables;
CREATE POLICY "Managers insert tables" ON public.gaming_tables
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- pit_rota
DROP POLICY IF EXISTS "Pit managers insert rota" ON public.pit_rota;
CREATE POLICY "Pit managers insert rota" ON public.pit_rota
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Pit managers update rota" ON public.pit_rota;
CREATE POLICY "Pit managers update rota" ON public.pit_rota
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Pit managers delete rota" ON public.pit_rota;
CREATE POLICY "Pit managers delete rota" ON public.pit_rota
  FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- staff_rota
DROP POLICY IF EXISTS "Managers insert staff rota" ON public.staff_rota;
CREATE POLICY "Managers insert staff rota" ON public.staff_rota
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update staff rota" ON public.staff_rota;
CREATE POLICY "Managers update staff rota" ON public.staff_rota
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers delete staff rota" ON public.staff_rota;
CREATE POLICY "Managers delete staff rota" ON public.staff_rota
  FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- staff_attendance
DROP POLICY IF EXISTS "Managers insert staff attendance" ON public.staff_attendance;
CREATE POLICY "Managers insert staff attendance" ON public.staff_attendance
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update staff attendance" ON public.staff_attendance;
CREATE POLICY "Managers update staff attendance" ON public.staff_attendance
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- dealer_attendance
DROP POLICY IF EXISTS "Pit managers insert attendance" ON public.dealer_attendance;
CREATE POLICY "Pit managers insert attendance" ON public.dealer_attendance
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Pit managers update attendance" ON public.dealer_attendance;
CREATE POLICY "Pit managers update attendance" ON public.dealer_attendance
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- table_tracker
DROP POLICY IF EXISTS "Pit managers insert tracker" ON public.table_tracker;
CREATE POLICY "Pit managers insert tracker" ON public.table_tracker
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

DROP POLICY IF EXISTS "Pit managers update tracker" ON public.table_tracker;
CREATE POLICY "Pit managers update tracker" ON public.table_tracker
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid())
         AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- player_chip_adjustments (Pit/managers insert)
DROP POLICY IF EXISTS "Pit/managers insert chip adjustments" ON public.player_chip_adjustments;
CREATE POLICY "Pit/managers insert chip adjustments" ON public.player_chip_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- chip_baseline
DROP POLICY IF EXISTS "Managers manage chip baseline" ON public.chip_baseline;
CREATE POLICY "Managers manage chip baseline" ON public.chip_baseline
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update chip baseline" ON public.chip_baseline;
CREATE POLICY "Managers update chip baseline" ON public.chip_baseline
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- chip_emissions
DROP POLICY IF EXISTS "Managers insert chip emissions" ON public.chip_emissions;
CREATE POLICY "Managers insert chip emissions" ON public.chip_emissions
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers see chip emissions" ON public.chip_emissions;
CREATE POLICY "Managers see chip emissions" ON public.chip_emissions
  FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- chip_initial_baseline
DROP POLICY IF EXISTS "Managers insert initial baseline" ON public.chip_initial_baseline;
CREATE POLICY "Managers insert initial baseline" ON public.chip_initial_baseline
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- chip_inventory
DROP POLICY IF EXISTS "Managers insert chip inventory" ON public.chip_inventory;
CREATE POLICY "Managers insert chip inventory" ON public.chip_inventory
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- table_daily_results
DROP POLICY IF EXISTS "Managers see own casino daily results" ON public.table_daily_results;
CREATE POLICY "Managers see own casino daily results" ON public.table_daily_results
  FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers insert daily results" ON public.table_daily_results;
CREATE POLICY "Managers insert daily results" ON public.table_daily_results
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update daily results" ON public.table_daily_results;
CREATE POLICY "Managers update daily results" ON public.table_daily_results
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers delete daily results" ON public.table_daily_results;
CREATE POLICY "Managers delete daily results" ON public.table_daily_results
  FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- player_groups
DROP POLICY IF EXISTS "Managers insert groups" ON public.player_groups;
CREATE POLICY "Managers insert groups" ON public.player_groups
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update groups" ON public.player_groups;
CREATE POLICY "Managers update groups" ON public.player_groups
  FOR UPDATE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.is_manager_op(auth.uid()));

-- group_members
DROP POLICY IF EXISTS "Managers insert members" ON public.group_members;
CREATE POLICY "Managers insert members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_op(auth.uid()));

DROP POLICY IF EXISTS "Managers update members" ON public.group_members;
CREATE POLICY "Managers update members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_manager_op(auth.uid()));

-- player_tags
DROP POLICY IF EXISTS "Managers delete tags" ON public.player_tags;
CREATE POLICY "Managers delete tags" ON public.player_tags
  FOR DELETE TO authenticated
  USING (public.is_manager_op(auth.uid()));

-- chip_transfers
DROP POLICY IF EXISTS "Pit/managers insert chip transfers" ON public.chip_transfers;
CREATE POLICY "Pit/managers insert chip transfers" ON public.chip_transfers
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid())
              AND (public.has_role(auth.uid(), 'pit'::app_role) OR public.is_manager_op(auth.uid())));

-- 3) Allow Floor Manager to manually close business day
CREATE OR REPLACE FUNCTION public.close_business_day(_casino_id uuid, _method text DEFAULT 'manual'::text, _force_close_cycles boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date;
  v_existing public.business_day_closures%ROWTYPE;
  v_snapshot jsonb;
  v_user uuid;
  v_lock_id uuid;
  v_open jsonb;
  v_finalize jsonb;
BEGIN
  v_user := auth.uid();

  IF _method = 'auto_11am' THEN
    v_today := ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1);
  ELSE
    v_today := public.get_current_business_date(_casino_id);
  END IF;

  IF _method = 'manual' THEN
    IF NOT (public.is_manager_op(v_user)
         OR public.has_role(v_user, 'pit'::app_role)) THEN
      RAISE EXCEPTION 'Insufficient privileges to close business day';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.business_day_closures
  WHERE casino_id = _casino_id AND business_date = v_today;

  IF FOUND THEN
    RETURN jsonb_build_object('status','already_closed','business_date',v_today);
  END IF;

  v_open := public.list_open_cycles_for_day(_casino_id);

  IF _method = 'manual' AND NOT _force_close_cycles THEN
    IF jsonb_array_length(COALESCE(v_open->'open_cage_shifts','[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(v_open->'active_sessions','[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(v_open->'open_visits','[]'::jsonb)) > 0 THEN
      RETURN jsonb_build_object(
        'status','has_open_cycles',
        'business_date', v_today,
        'open', v_open
      );
    END IF;
  END IF;

  INSERT INTO public.system_locks(casino_id, reason, locked_until, created_by)
  VALUES (_casino_id, 'business_day_rollover', now() + interval '90 seconds', v_user)
  RETURNING id INTO v_lock_id;

  BEGIN
    IF _force_close_cycles THEN
      v_finalize := public.finalize_open_cycles(_casino_id, v_today);
    ELSE
      v_finalize := jsonb_build_object('forced', false);
    END IF;

    v_snapshot := public.build_business_day_snapshot(_casino_id, v_today);

    INSERT INTO public.business_day_closures(
      casino_id, business_date, closed_by, close_method, snapshot
    ) VALUES (
      _casino_id, v_today, v_user, _method, v_snapshot
    );

    DELETE FROM public.system_locks WHERE id = v_lock_id;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.system_locks WHERE id = v_lock_id;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'status','closed',
    'business_date', v_today,
    'forced', _force_close_cycles,
    'finalize', v_finalize
  );
END;
$function$;