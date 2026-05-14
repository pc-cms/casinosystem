-- Add staff_rota, staff_attendance, staff_employees permissions for pit role
-- so Pit users can view (and in some cases edit) floor/security/office rota & attendance.
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
VALUES
  ('pit', 'staff_rota', true, true, 'all'),
  ('pit', 'staff_attendance', true, true, 'all'),
  ('pit', 'staff_employees', true, false, 'all')
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_write = EXCLUDED.can_write,
  day_horizon = EXCLUDED.day_horizon;
