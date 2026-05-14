-- staff_rota: grant Pit role write access (insert/update/delete)
DROP POLICY IF EXISTS "Pit insert staff rota" ON public.staff_rota;
CREATE POLICY "Pit insert staff rota" ON public.staff_rota
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'pit'::app_role));

DROP POLICY IF EXISTS "Pit update staff rota" ON public.staff_rota;
CREATE POLICY "Pit update staff rota" ON public.staff_rota
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'pit'::app_role));

DROP POLICY IF EXISTS "Pit delete staff rota" ON public.staff_rota;
CREATE POLICY "Pit delete staff rota" ON public.staff_rota
  FOR DELETE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'pit'::app_role));

-- staff_attendance: grant Pit role write access (insert/update)
DROP POLICY IF EXISTS "Pit insert staff attendance" ON public.staff_attendance;
CREATE POLICY "Pit insert staff attendance" ON public.staff_attendance
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'pit'::app_role));

DROP POLICY IF EXISTS "Pit update staff attendance" ON public.staff_attendance;
CREATE POLICY "Pit update staff attendance" ON public.staff_attendance
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'pit'::app_role));
