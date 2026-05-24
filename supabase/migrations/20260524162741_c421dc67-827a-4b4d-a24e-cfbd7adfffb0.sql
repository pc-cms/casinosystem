DROP POLICY IF EXISTS "weekly_bonus_pools_select" ON public.weekly_bonus_pools;
DROP POLICY IF EXISTS "weekly_bonus_pools_write" ON public.weekly_bonus_pools;
DROP POLICY IF EXISTS "weekly_bonus_entries_select" ON public.weekly_bonus_entries;
DROP POLICY IF EXISTS "weekly_bonus_entries_write" ON public.weekly_bonus_entries;

CREATE POLICY "weekly_bonus_pools_select"
ON public.weekly_bonus_pools
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
      OR public.has_role(auth.uid(), 'surveillance'::app_role)
    )
  )
);

CREATE POLICY "weekly_bonus_pools_write"
ON public.weekly_bonus_pools
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
);

CREATE POLICY "weekly_bonus_entries_select"
ON public.weekly_bonus_entries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
      OR public.has_role(auth.uid(), 'surveillance'::app_role)
    )
  )
);

CREATE POLICY "weekly_bonus_entries_write"
ON public.weekly_bonus_entries
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.user_has_casino_access(auth.uid(), casino_id)
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'floor_manager'::app_role)
      OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    )
  )
);