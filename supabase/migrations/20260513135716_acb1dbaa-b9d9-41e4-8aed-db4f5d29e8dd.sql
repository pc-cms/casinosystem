
-- Extend employees with onboarding/contract/pit fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS onboarding_date date,
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_end date,
  ADD COLUMN IF NOT EXISTS dealer_category text,
  ADD COLUMN IF NOT EXISTS is_pit_boss boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_dealer ON public.employees(dealer_id);

-- Reimport RPC: rebuild employees for a casino from staff_members + dealers
CREATE OR REPLACE FUNCTION public.reimport_staff_master(p_casino_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_authorized boolean;
  v_staff_count int := 0;
  v_dealer_count int := 0;
BEGIN
  -- Authorization: HR / manager / super_admin only (allow service-role calls when no auth.uid)
  IF v_user IS NOT NULL THEN
    SELECT (has_role(v_user, 'hr'::app_role)
         OR has_role(v_user, 'manager'::app_role)
         OR has_role(v_user, 'super_admin'::app_role))
      INTO v_authorized;
    IF NOT v_authorized THEN
      RAISE EXCEPTION 'Not authorized to reimport staff master';
    END IF;
  END IF;

  -- Wipe existing employees and bank accounts for this casino
  DELETE FROM public.employee_bank_accounts
   WHERE employee_id IN (SELECT id FROM public.employees WHERE casino_id = p_casino_id);
  DELETE FROM public.employees WHERE casino_id = p_casino_id;

  -- Insert from staff_members (Floor / Security / Office)
  INSERT INTO public.employees (
    casino_id, staff_member_id, full_name, position, department,
    employment_date, onboarding_date, contract_start, contract_end,
    photo_url, basic_salary, payroll_status, source_table, created_by
  )
  SELECT
    s.casino_id,
    s.id,
    s.name,
    CASE s.department::text
      WHEN 'cashier'   THEN 'Cashier'
      WHEN 'bartender' THEN 'Bartender'
      WHEN 'hostess'   THEN 'Hostess'
      WHEN 'waiter'    THEN 'Waiter'
      WHEN 'cleaner'   THEN 'Cleaner'
      WHEN 'reception' THEN 'Receptionist'
      WHEN 'security'  THEN 'Security'
      WHEN 'it'        THEN 'IT'
      WHEN 'hr'        THEN 'HR'
      WHEN 'driver'    THEN 'Driver'
      ELSE initcap(s.department::text)
    END,
    CASE s.department::text
      WHEN 'security' THEN 'Security'
      WHEN 'it'       THEN 'Office'
      WHEN 'hr'       THEN 'Office'
      WHEN 'driver'   THEN 'Office'
      ELSE 'Floor'
    END,
    COALESCE(s.onboarding_date, s.contract_start),
    s.onboarding_date,
    s.contract_start,
    s.contract_end,
    s.photo_url,
    COALESCE(s.salary, 0)::bigint,
    CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END,
    'staff_members',
    v_user
  FROM public.staff_members s
  WHERE s.casino_id = p_casino_id;
  GET DIAGNOSTICS v_staff_count = ROW_COUNT;

  -- Insert from dealers (Pit)
  INSERT INTO public.employees (
    casino_id, dealer_id, full_name, position, department,
    employment_date, onboarding_date, contract_start, contract_end,
    photo_url, basic_salary, payroll_status,
    dealer_category, is_pit_boss, source_table, created_by
  )
  SELECT
    d.casino_id,
    d.id,
    d.name,
    CASE
      WHEN d.is_pit_boss THEN 'Pit Boss'
      WHEN d.category::text = 'dealer' THEN 'Dealer'
      WHEN d.category::text = 'inspector' THEN 'Inspector'
      WHEN d.category::text = 'trainee' THEN 'Trainee'
      ELSE initcap(d.category::text)
    END,
    'Pit',
    COALESCE(d.onboarding_date, d.contract_start),
    d.onboarding_date,
    d.contract_start,
    d.contract_end,
    d.photo_url,
    COALESCE(d.salary, 0)::bigint,
    CASE WHEN d.is_active THEN 'active' ELSE 'inactive' END,
    d.category::text,
    d.is_pit_boss,
    'dealers',
    v_user
  FROM public.dealers d
  WHERE d.casino_id = p_casino_id;
  GET DIAGNOSTICS v_dealer_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'staff_imported',  v_staff_count,
    'dealers_imported', v_dealer_count,
    'total', v_staff_count + v_dealer_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reimport_staff_master(uuid) TO authenticated;
