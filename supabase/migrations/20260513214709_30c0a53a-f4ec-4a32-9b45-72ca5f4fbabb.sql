ALTER TABLE public.payroll_entries
  DROP CONSTRAINT IF EXISTS payroll_entries_employee_id_fkey;

ALTER TABLE public.payroll_entries
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;