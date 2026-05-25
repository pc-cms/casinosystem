
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('cashier'::app_role,         'cage_slots', true, true,  'today'::day_horizon),
  ('manager'::app_role,         'cage_slots', true, false, 'all'::day_horizon),
  ('finance_manager'::app_role, 'cage_slots', true, false, 'all'::day_horizon),
  ('surveillance'::app_role,    'cage_slots', true, false, 'all'::day_horizon),
  ('floor_manager'::app_role,   'cage_slots', true, false, 'all'::day_horizon),
  ('super_admin'::app_role,     'cage_slots', true, true,  'all'::day_horizon)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      day_horizon = EXCLUDED.day_horizon,
      updated_at = now();
