-- Clean up legacy/removed modules from role_module_defaults and user_module_permissions.
-- Modules removed: cage_closings (replaced by closings), staff (legacy split),
-- pitbook (feature archived), business_days (rolled into reports),
-- weekly_bonus / monthly_tips (unified into tips_and_bonuses).
DELETE FROM public.role_module_defaults
WHERE module_key IN ('cage_closings','staff','pitbook','business_days','weekly_bonus','monthly_tips');

DELETE FROM public.user_module_permissions
WHERE module_key IN ('cage_closings','staff','pitbook','business_days','weekly_bonus','monthly_tips');

-- Add cancelled_transactions defaults (audit surface)
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
VALUES
  ('manager',         'cancelled_transactions', true,  false, 'all'),
  ('floor_manager',   'cancelled_transactions', true,  false, 'all'),
  ('finance_manager', 'cancelled_transactions', true,  false, 'all'),
  ('super_admin',     'cancelled_transactions', true,  true,  'all'),
  ('surveillance',    'cancelled_transactions', true,  false, 'all')
ON CONFLICT (role, module_key) DO NOTHING;
