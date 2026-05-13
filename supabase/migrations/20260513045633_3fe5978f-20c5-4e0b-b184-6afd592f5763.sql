INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write)
VALUES
  ('surveillance', 'cctv_dashboard', true, false),
  ('super_admin',  'cctv_dashboard', true, false)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write;