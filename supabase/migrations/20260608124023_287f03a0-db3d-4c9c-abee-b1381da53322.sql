
DROP POLICY IF EXISTS "Incident photos public read" ON storage.objects;

CREATE POLICY "Incident photos authed staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'surveillance'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users delete player photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update player photos" ON storage.objects;

CREATE POLICY "Authorized roles delete player photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT (profiles.casino_id)::text
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      LIMIT 1
    )
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Authorized roles update player photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT (profiles.casino_id)::text
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      LIMIT 1
    )
    AND (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT (profiles.casino_id)::text
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS cdsl_read ON public.club_daily_spend_limits;
CREATE POLICY cdsl_read ON public.club_daily_spend_limits
  FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS fdr_read ON public.fin_daily_rates;
CREATE POLICY fdr_read ON public.fin_daily_rates
  FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS fw_read ON public.fin_wallets;
CREATE POLICY fw_read ON public.fin_wallets
  FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS fb_read ON public.fin_budget;
CREATE POLICY fb_read ON public.fin_budget
  FOR SELECT TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
