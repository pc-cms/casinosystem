INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
VALUES
  ('manager', 'players', true, true, 'all'),
  ('floor_manager', 'players', true, true, 'all')
ON CONFLICT (role, module_key) DO UPDATE
SET can_view = true, can_write = true, day_horizon = 'all';