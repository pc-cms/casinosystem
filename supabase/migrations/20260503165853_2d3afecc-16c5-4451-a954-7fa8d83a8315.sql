-- Fix: Admin Users tab shows "No roles assigned" because user_roles SELECT
-- policy only exposes the caller's own rows. Managers (scoped to their casino)
-- and global roles (super_admin, finance_manager) need to read other users' roles
-- to manage them in the Admin → Users & Roles tab.

-- Manager: see roles for users in the same casino
CREATE POLICY "Managers see roles for same casino"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);

-- Super Admin: see all roles
CREATE POLICY "Super admins see all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Finance Manager: see all roles (network-wide read access)
CREATE POLICY "Finance managers see all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'finance_manager'::app_role));

-- HR: see roles for users in the same casino (HR manages personnel)
CREATE POLICY "HR sees roles for same casino"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);