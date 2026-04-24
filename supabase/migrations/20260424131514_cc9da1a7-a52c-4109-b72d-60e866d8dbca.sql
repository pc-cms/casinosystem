-- Allow Manager and HR to permanently delete staff members
CREATE POLICY "Manager and HR delete staff members"
ON public.staff_members
FOR DELETE
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

-- Allow Manager and HR to permanently delete dealers
CREATE POLICY "Manager and HR delete dealers"
ON public.dealers
FOR DELETE
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);