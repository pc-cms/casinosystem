DELETE FROM public.role_module_defaults
WHERE module_key = 'cage'
  AND role IN ('manager', 'floor_manager', 'finance_manager', 'surveillance', 'pit');

INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('super_admin', 'cage', true, true, 'all'),
  ('cashier', 'cage', true, true, 'today')
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_write = EXCLUDED.can_write,
  day_horizon = EXCLUDED.day_horizon;

INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('super_admin', 'cage_view', true, true, 'all'),
  ('manager', 'cage_view', true, false, 'all'),
  ('floor_manager', 'cage_view', true, false, 'all'),
  ('finance_manager', 'cage_view', true, false, 'all'),
  ('surveillance', 'cage_view', true, false, 'all')
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_write = EXCLUDED.can_write,
  day_horizon = EXCLUDED.day_horizon;

DELETE FROM public.role_module_defaults
WHERE module_key = 'cage_closings'
  AND role IN ('manager', 'floor_manager', 'cashier', 'surveillance', 'pit');

DELETE FROM public.user_module_permissions
WHERE module_key = 'cage'
  AND can_view = true
  AND user_id IN (
    SELECT user_id
    FROM public.user_roles
    WHERE role IN ('manager', 'floor_manager', 'finance_manager', 'surveillance', 'pit')
  );

DELETE FROM public.user_module_permissions
WHERE module_key = 'cage_closings'
  AND can_view = true
  AND user_id IN (
    SELECT user_id
    FROM public.user_roles
    WHERE role IN ('manager', 'floor_manager', 'cashier', 'surveillance', 'pit')
  );