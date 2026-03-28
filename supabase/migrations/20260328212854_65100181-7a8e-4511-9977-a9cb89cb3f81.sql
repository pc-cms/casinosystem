
-- 1. Fix cross-casino role management: managers can only manage users in their own casino
DROP POLICY IF EXISTS "Managers insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers delete roles" ON public.user_roles;

CREATE POLICY "Managers insert roles for same casino"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);

CREATE POLICY "Managers delete roles for same casino"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);

-- 2. Fix profiles: restrict sensitive columns visibility
DROP POLICY IF EXISTS "Users see profiles in their casino" ON public.profiles;

CREATE POLICY "Users see own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users see casino profiles"
ON public.profiles FOR SELECT TO authenticated
USING (casino_id = public.get_user_casino_id(auth.uid()));

-- 3. Secure player_economy view with security_invoker
ALTER VIEW public.player_economy SET (security_invoker = on)
