DROP POLICY IF EXISTS "Managers see own casino daily results" ON public.table_daily_results;

CREATE POLICY "Casino users see own casino daily results"
  ON public.table_daily_results
  FOR SELECT
  TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));
