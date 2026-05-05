CREATE POLICY "Casino users cancel pending expenses"
ON public.expenses
FOR DELETE
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND approved = false
);