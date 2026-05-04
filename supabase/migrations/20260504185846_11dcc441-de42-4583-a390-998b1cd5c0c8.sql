DROP POLICY IF EXISTS "Reception/pit/managers update visits" ON public.casino_visits;
DROP POLICY IF EXISTS "Reception/pit/managers insert visits" ON public.casino_visits;

CREATE POLICY "Reception pit managers insert visits"
ON public.casino_visits
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

CREATE POLICY "Reception pit managers update visits"
ON public.casino_visits
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);