-- Fix rota_locks RLS: allow multi-casino users and include floor_manager.
DROP POLICY IF EXISTS "Casino users see rota locks" ON public.rota_locks;
DROP POLICY IF EXISTS "Manager/HR/SuperAdmin lock month" ON public.rota_locks;
DROP POLICY IF EXISTS "Manager/HR/SuperAdmin unlock month" ON public.rota_locks;

CREATE POLICY "Casino users see rota locks"
ON public.rota_locks FOR SELECT
USING (public.user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Manager/HR/SuperAdmin lock month"
ON public.rota_locks FOR INSERT
WITH CHECK (
  public.user_has_casino_access(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'floor_manager'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "Manager/HR/SuperAdmin unlock month"
ON public.rota_locks FOR DELETE
USING (
  public.user_has_casino_access(auth.uid(), casino_id)
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'floor_manager'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);