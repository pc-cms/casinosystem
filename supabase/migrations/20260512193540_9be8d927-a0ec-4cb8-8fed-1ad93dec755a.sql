
-- Phase 2 flat-URL migration: split legacy "staff" module into 3 flat keys
-- and add pit_dealers for the Pit employee tab.

-- pit_dealers: HR view of dealer employee directory (was /pit?tab=employee)
INSERT INTO role_module_defaults (role, module_key, can_view, can_write) VALUES
  ('super_admin',     'pit_dealers', true,  true),
  ('manager',         'pit_dealers', true,  true),
  ('floor_manager',   'pit_dealers', true,  false),
  ('pit',             'pit_dealers', true,  false),
  ('hr',              'pit_dealers', true,  true),
  ('finance_manager', 'pit_dealers', true,  false),
  ('surveillance',    'pit_dealers', true,  false)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view, can_write = EXCLUDED.can_write;

-- staff_employees: Floor/Security/Office employee directory (was /staff?tab=employee)
INSERT INTO role_module_defaults (role, module_key, can_view, can_write) VALUES
  ('super_admin',     'staff_employees', true,  true),
  ('manager',         'staff_employees', true,  true),
  ('floor_manager',   'staff_employees', true,  false),
  ('hr',              'staff_employees', true,  true),
  ('finance_manager', 'staff_employees', true,  false)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view, can_write = EXCLUDED.can_write;

-- staff_rota: Floor/Security/Office rota grids (was /staff?tab=rota_*)
INSERT INTO role_module_defaults (role, module_key, can_view, can_write) VALUES
  ('super_admin',     'staff_rota', true,  true),
  ('manager',         'staff_rota', true,  true),
  ('floor_manager',   'staff_rota', true,  false),
  ('hr',              'staff_rota', true,  true),
  ('finance_manager', 'staff_rota', true,  false)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view, can_write = EXCLUDED.can_write;

-- staff_attendance: Floor/Security/Office attendance grids (was /staff?tab=attendance)
INSERT INTO role_module_defaults (role, module_key, can_view, can_write) VALUES
  ('super_admin',     'staff_attendance', true,  true),
  ('manager',         'staff_attendance', true,  true),
  ('floor_manager',   'staff_attendance', true,  false),
  ('hr',              'staff_attendance', true,  true),
  ('finance_manager', 'staff_attendance', true,  false)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view, can_write = EXCLUDED.can_write;
