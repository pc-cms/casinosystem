
-- Split reception page into sub-modules so cashier can see only Register tab.
-- Parent module `reception` controls page-level access (sidebar + route).
-- Sub-modules gate individual tabs inside the page.

INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  -- super_admin: all three
  ('super_admin',     'reception_checkin', true, true, 'all'),
  ('super_admin',     'reception_register', true, true, 'all'),
  ('super_admin',     'reception_update', true, true, 'all'),
  -- manager: all three
  ('manager',         'reception_checkin', true, true, 'all'),
  ('manager',         'reception_register', true, true, 'all'),
  ('manager',         'reception_update', true, true, 'all'),
  -- floor_manager: all three
  ('floor_manager',   'reception_checkin', true, true, 'today'),
  ('floor_manager',   'reception_register', true, true, 'today'),
  ('floor_manager',   'reception_update', true, true, 'today'),
  -- reception role: all three (full reception desk)
  ('reception',       'reception_checkin', true, true, 'today'),
  ('reception',       'reception_register', true, true, 'today'),
  ('reception',       'reception_update', true, true, 'today'),
  -- cashier: ONLY register
  ('cashier',         'reception_register', true, true, 'today'),
  -- finance_manager: read-only all
  ('finance_manager', 'reception_checkin', true, false, 'all'),
  ('finance_manager', 'reception_register', true, false, 'all'),
  ('finance_manager', 'reception_update', true, false, 'all')
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_write = EXCLUDED.can_write,
  day_horizon = EXCLUDED.day_horizon;

-- Cashier explicitly does NOT get reception_checkin / reception_update.
DELETE FROM public.role_module_defaults
WHERE role = 'cashier' AND module_key IN ('reception_checkin', 'reception_update');

-- Clear stale per-user overrides for these keys so role defaults apply.
DELETE FROM public.user_module_permissions
WHERE module_key IN ('reception_checkin', 'reception_register', 'reception_update');

NOTIFY pgrst, 'reload schema';
