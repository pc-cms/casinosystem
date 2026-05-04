DROP POLICY IF EXISTS "Authorized roles create players" ON public.players;
CREATE POLICY "Authorized roles create players"
ON public.players
FOR INSERT
TO authenticated
WITH CHECK (
  casino_id = public.get_user_casino_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'reception'::public.app_role)
    OR public.has_role(auth.uid(), 'pit'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Authorized roles update players" ON public.players;
CREATE POLICY "Authorized roles update players"
ON public.players
FOR UPDATE
TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'reception'::public.app_role)
    OR public.has_role(auth.uid(), 'pit'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  casino_id = public.get_user_casino_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'reception'::public.app_role)
    OR public.has_role(auth.uid(), 'pit'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Authorized roles manage cards" ON public.player_cards;
CREATE POLICY "Authorized roles manage cards"
ON public.player_cards
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'reception'::public.app_role)
    OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = player_cards.player_id
      AND p.casino_id = public.get_user_casino_id(auth.uid())
  )
);