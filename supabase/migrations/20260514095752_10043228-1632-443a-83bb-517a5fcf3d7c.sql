
-- Phase 4 follow-up: open SELECT on employees for same-casino users.
-- Before Phase 4 the operational grids read the `dealers` table which had a
-- permissive same-casino SELECT policy. Now they read `employees`, so we
-- restore equivalent visibility. Write access remains HR-only.

CREATE POLICY "employees_select_same_casino"
ON public.employees
FOR SELECT
TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
);

CREATE POLICY "employees_select_surveillance_assigned"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'surveillance'::public.app_role)
  AND public.user_has_casino_access(auth.uid(), casino_id)
);
