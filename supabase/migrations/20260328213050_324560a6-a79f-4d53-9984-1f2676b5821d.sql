
-- 1. Fix credentials policy - scope to same casino
DROP POLICY IF EXISTS "Managers insert credentials" ON public.user_credentials;

CREATE POLICY "Managers insert credentials same casino"
ON public.user_credentials FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_credentials.user_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);

-- 2. player_economy is a VIEW with security_invoker=on.
-- It reads from players table which already has casino-scoped RLS.
-- The scanner may not detect this. Let's verify by adding explicit RLS note.
-- Views with security_invoker inherit from base tables - players has RLS.
-- No further action needed for player_economy since it uses security_invoker=on
-- and the underlying players table enforces casino_id scoping.
