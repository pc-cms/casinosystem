-- Phase 1: Staff Master prep — close orphans + add employee_id columns + indexes

-- 1. Create employees row for the single orphan staff_member (Nicole, hostess)
INSERT INTO public.employees (
  casino_id, staff_member_id, full_name, position, department,
  basic_salary, payroll_status, onboarding_date, source_table
)
SELECT
  sm.casino_id, sm.id, sm.name,
  CASE sm.department::text
    WHEN 'security' THEN 'Security'
    WHEN 'cashier' THEN 'Cashier'
    WHEN 'bartender' THEN 'Bartender'
    WHEN 'hostess' THEN 'Hostess'
    WHEN 'waiter' THEN 'Waiter'
    WHEN 'cleaner' THEN 'Housekeeper'
    WHEN 'it' THEN 'IT'
    WHEN 'hr' THEN 'HR'
    WHEN 'driver' THEN 'IT'
    WHEN 'reception' THEN 'Hostess'
    ELSE 'Housekeeper'
  END,
  CASE sm.department::text
    WHEN 'security' THEN 'Security'
    WHEN 'cashier' THEN 'Cash Desk'
    WHEN 'bartender' THEN 'Bar'
    WHEN 'hostess' THEN 'Slots'
    WHEN 'waiter' THEN 'Slots'
    WHEN 'cleaner' THEN 'Housekeeper'
    WHEN 'it' THEN 'Office'
    WHEN 'hr' THEN 'Office'
    WHEN 'driver' THEN 'Office'
    WHEN 'reception' THEN 'Slots'
    ELSE 'Housekeeper'
  END,
  COALESCE(sm.salary,0)::bigint, 'active', sm.onboarding_date, 'staff_members'
FROM public.staff_members sm
WHERE sm.id NOT IN (SELECT staff_member_id FROM public.employees WHERE staff_member_id IS NOT NULL);

-- 2. Add employee_id columns
ALTER TABLE public.breaklist        ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.staff_rota       ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_breaklist_employee        ON public.breaklist(casino_id, employee_id, date, time_slot);
CREATE INDEX IF NOT EXISTS idx_staff_rota_employee       ON public.staff_rota(casino_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_employee ON public.staff_attendance(casino_id, employee_id, date);

-- 4. Sanity view
CREATE OR REPLACE VIEW public.v_staff_master_legacy_map AS
SELECT e.id AS employee_id, e.casino_id, e.full_name, e.department, e.position,
       e.dealer_id AS legacy_dealer_id, e.staff_member_id AS legacy_staff_member_id
FROM public.employees e;