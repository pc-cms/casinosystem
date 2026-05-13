
DROP POLICY IF EXISTS "Cashiers close shifts" ON public.shifts;
DROP POLICY IF EXISTS "Cashiers open shifts" ON public.shifts;

CREATE POLICY "Cashiers close shifts"
ON public.shifts
FOR UPDATE
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (
    has_role(auth.uid(), 'cashier'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
  )
);

CREATE POLICY "Cashiers open shifts"
ON public.shifts
FOR INSERT
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND opened_by = auth.uid()
  AND (
    has_role(auth.uid(), 'cashier'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
  )
);
