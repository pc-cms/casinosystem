
-- 1) Extend cctv_observations
ALTER TABLE public.cctv_observations
  ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS player_id uuid,
  ADD COLUMN IF NOT EXISTS table_id uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid;

-- 2) Broaden SELECT to pit + finance_manager (manager + surveillance + super_admin already covered)
DROP POLICY IF EXISTS "Pit sees casino observations" ON public.cctv_observations;
CREATE POLICY "Pit sees casino observations"
ON public.cctv_observations
FOR SELECT
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND has_role(auth.uid(), 'pit'::app_role)
);

DROP POLICY IF EXISTS "Finance managers see all observations" ON public.cctv_observations;
CREATE POLICY "Finance managers see all observations"
ON public.cctv_observations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'finance_manager'::app_role));

-- 3) Allow Pit / Manager / Super admin to acknowledge (UPDATE only acknowledged_*)
DROP POLICY IF EXISTS "Pit/Manager acknowledge observations" ON public.cctv_observations;
CREATE POLICY "Pit/Manager acknowledge observations"
ON public.cctv_observations
FOR UPDATE
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (
    has_role(auth.uid(), 'pit'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND (
    has_role(auth.uid(), 'pit'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- 4) Remove surveillance INSERT on chip_transfers
DROP POLICY IF EXISTS "Pit/managers/surveillance insert chip transfers" ON public.chip_transfers;
CREATE POLICY "Pit/managers insert chip transfers"
ON public.chip_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND operator_id = auth.uid()
  AND (
    has_role(auth.uid(), 'pit'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);
