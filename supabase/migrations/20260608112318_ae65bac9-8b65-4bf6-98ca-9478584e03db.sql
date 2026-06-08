
-- Fix 1: cage_slots_tips_cd_payouts open access
DROP POLICY IF EXISTS slots_tips_cd_payouts_select ON public.cage_slots_tips_cd_payouts;
DROP POLICY IF EXISTS slots_tips_cd_payouts_insert ON public.cage_slots_tips_cd_payouts;
DROP POLICY IF EXISTS slots_tips_cd_payouts_update ON public.cage_slots_tips_cd_payouts;

CREATE POLICY slots_tips_cd_payouts_select_same_casino
  ON public.cage_slots_tips_cd_payouts FOR SELECT
  TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY slots_tips_cd_payouts_insert_same_casino
  ON public.cage_slots_tips_cd_payouts FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (
      has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY slots_tips_cd_payouts_update_manager
  ON public.cage_slots_tips_cd_payouts FOR UPDATE
  TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()));

-- Fix 2: club_accounts cross-casino credential exposure
-- Restrict reception/cashier/manager reads to players in their own casino.
DROP POLICY IF EXISTS "Reception/cashier read club_accounts" ON public.club_accounts;

CREATE POLICY "Reception/cashier read club_accounts same casino"
  ON public.club_accounts FOR SELECT
  TO authenticated
  USING (
    (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = club_accounts.player_id
        AND p.casino_id = get_user_casino_id(auth.uid())
    )
  );
