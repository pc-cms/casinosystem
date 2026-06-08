
DROP POLICY IF EXISTS fdc_read ON public.fin_day_closing;
CREATE POLICY fdc_read ON public.fin_day_closing
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR casino_id = get_user_casino_id(auth.uid())
  );

DROP POLICY IF EXISTS fmc_read ON public.fin_money_change;
CREATE POLICY fmc_read ON public.fin_money_change
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR casino_id = get_user_casino_id(auth.uid())
  );

DROP POLICY IF EXISTS fwtx_read ON public.fin_wallet_tx;
CREATE POLICY fwtx_read ON public.fin_wallet_tx
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR casino_id = get_user_casino_id(auth.uid())
  );
