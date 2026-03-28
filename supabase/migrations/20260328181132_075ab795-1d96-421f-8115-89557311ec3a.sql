
-- Allow deletion of breaklist entries for the S/A shift trigger
CREATE POLICY "System deletes breaklist on shift" ON public.breaklist FOR DELETE TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));
