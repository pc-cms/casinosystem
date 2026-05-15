DROP POLICY IF EXISTS "super_admin deletes sync jobs" ON public.initial_sync_jobs;
CREATE POLICY "super_admin deletes sync jobs"
  ON public.initial_sync_jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));