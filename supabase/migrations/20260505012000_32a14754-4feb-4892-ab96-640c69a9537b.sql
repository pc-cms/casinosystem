-- Allow managers to hard-delete expenses (with manager override on UI)
CREATE POLICY "Managers delete expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    casino_id = public.get_user_casino_id(auth.uid())
    AND (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );