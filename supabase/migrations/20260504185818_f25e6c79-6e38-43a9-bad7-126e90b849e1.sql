DROP POLICY IF EXISTS "Pit managers insert client sessions" ON public.client_sessions;
DROP POLICY IF EXISTS "Pit managers update client sessions" ON public.client_sessions;

CREATE POLICY "Pit reception managers insert client sessions"
ON public.client_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

CREATE POLICY "Pit reception managers update client sessions"
ON public.client_sessions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);