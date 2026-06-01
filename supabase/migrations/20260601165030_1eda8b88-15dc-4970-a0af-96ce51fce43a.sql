CREATE POLICY "incidents_floor_manager_view"
ON public.incidents
FOR SELECT
USING (
  has_role(auth.uid(), 'floor_manager'::app_role)
  AND casino_id = get_user_casino_id(auth.uid())
);