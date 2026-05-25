
-- 1. Update RLS helpers used by cage_slots_* tables
CREATE OR REPLACE FUNCTION public.cs_can_write(_casino uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (_casino = public.get_user_casino_id(auth.uid()))
     AND (
       public.has_role(auth.uid(),'cashier_slots'::public.app_role)
       OR public.has_role(auth.uid(),'manager'::public.app_role)
       OR public.has_role(auth.uid(),'floor_manager'::public.app_role)
     )
  OR public.has_role(auth.uid(),'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.cs_can_view(_casino uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (_casino = public.get_user_casino_id(auth.uid()))
     AND (
       public.has_role(auth.uid(),'cashier_slots'::public.app_role)
       OR public.has_role(auth.uid(),'manager'::public.app_role)
       OR public.has_role(auth.uid(),'floor_manager'::public.app_role)
       OR public.has_role(auth.uid(),'finance_manager'::public.app_role)
       OR public.has_role(auth.uid(),'surveillance'::public.app_role)
       OR public.has_role(auth.uid(),'pit'::public.app_role)
     )
  OR public.has_role(auth.uid(),'super_admin'::public.app_role)
$$;

-- 2. cage_slots_transfers: replace 'cashier' with 'cashier_slots' on write policies
DROP POLICY IF EXISTS "Cashiers/managers insert slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Cashiers/managers insert slots transfers"
ON public.cage_slots_transfers
FOR INSERT TO authenticated
WITH CHECK (
  casino_id = public.get_user_casino_id(auth.uid())
  AND operator_id = auth.uid()
  AND (
    public.has_role(auth.uid(),'cashier_slots'::public.app_role)
    OR public.has_role(auth.uid(),'manager'::public.app_role)
    OR public.has_role(auth.uid(),'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Cashiers/managers approve slots transfers" ON public.cage_slots_transfers;
CREATE POLICY "Cashiers/managers approve slots transfers"
ON public.cage_slots_transfers
FOR UPDATE TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  AND (
    public.has_role(auth.uid(),'cashier_slots'::public.app_role)
    OR public.has_role(auth.uid(),'manager'::public.app_role)
    OR public.has_role(auth.uid(),'super_admin'::public.app_role)
  )
)
WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()));

-- 3. Strip cage_slots from live cashier defaults
DELETE FROM public.role_module_defaults
 WHERE role = 'cashier'::public.app_role AND module_key = 'cage_slots';

-- 4. Seed cashier_slots defaults
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('cashier_slots'::public.app_role, 'cage_slots', true, true, 'today'::day_horizon),
  ('cashier_slots'::public.app_role, 'expenses',   true, true, 'today'::day_horizon)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      day_horizon = EXCLUDED.day_horizon,
      updated_at = now();
