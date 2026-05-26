DROP POLICY IF EXISTS "Authorized roles create expenses" ON public.expenses;

CREATE POLICY "Authorized roles create expenses" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'cashier'::app_role)
    OR has_role(auth.uid(), 'cashier_slots'::app_role)
    OR is_manager_op(auth.uid())
  )
);