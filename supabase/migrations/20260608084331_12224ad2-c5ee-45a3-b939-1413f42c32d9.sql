DROP POLICY IF EXISTS "Read promo redemptions" ON public.promo_redemptions;
CREATE POLICY "Read promo redemptions" ON public.promo_redemptions
FOR SELECT TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'account_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
);

DROP POLICY IF EXISTS shop_orders_read ON public.shop_orders;
CREATE POLICY shop_orders_read ON public.shop_orders
FOR SELECT TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'account_manager'::app_role)
);