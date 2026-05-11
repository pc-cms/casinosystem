DROP POLICY IF EXISTS "Casino users see own casino daily results" ON public.table_daily_results;
DROP POLICY IF EXISTS "Managers see own casino daily results" ON public.table_daily_results;

CREATE POLICY "Managers see own casino daily results"
  ON public.table_daily_results
  FOR SELECT
  TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'surveillance'::app_role)
    )
  );