
-- 1) player_crm: network-wide SELECT + write for account_manager
DROP POLICY IF EXISTS "crm read by casino access" ON public.player_crm;
CREATE POLICY "crm read by casino access"
  ON public.player_crm FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_casino_access uca
      WHERE uca.user_id = auth.uid() AND uca.casino_id = player_crm.casino_id
    )
  );

DROP POLICY IF EXISTS "crm write by manager/host" ON public.player_crm;
CREATE POLICY "crm write by manager/host"
  ON public.player_crm FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'reception'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'reception'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  );

-- 2) player_notes: network-wide SELECT + INSERT for account_manager
DROP POLICY IF EXISTS "Player notes visible within casino access" ON public.player_notes;
CREATE POLICY "Player notes visible within casino access"
ON public.player_notes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'surveillance'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_notes.player_id
      AND user_has_casino_access(auth.uid(), p.casino_id)
  )
);

DROP POLICY IF EXISTS "Authorized roles create player notes" ON public.player_notes;
CREATE POLICY "Authorized roles create player notes"
  ON public.player_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (
        casino_id = public.get_user_casino_id(auth.uid())
        AND (
          public.has_role(auth.uid(), 'reception'::app_role)
          OR public.has_role(auth.uid(), 'pit'::app_role)
          OR public.has_role(auth.uid(), 'cashier'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
        )
      )
      OR (
        public.has_role(auth.uid(), 'surveillance'::app_role)
        AND public.user_has_casino_access(auth.uid(), casino_id)
      )
      OR public.has_role(auth.uid(), 'account_manager'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 3) Seed kyc_reviews module default for account_manager
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
VALUES ('account_manager', 'kyc_reviews', true, true, 'all'::day_horizon)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = true, can_write = true;
