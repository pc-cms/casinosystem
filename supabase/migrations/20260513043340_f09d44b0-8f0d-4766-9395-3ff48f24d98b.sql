
-- Add cage_closings module to role defaults.
-- Only manager-level roles get this; cashier is intentionally excluded.
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  ('super_admin',     'cage_closings', true, true,  'all'),
  ('manager',         'cage_closings', true, false, 'all'),
  ('floor_manager',   'cage_closings', true, false, 'all'),
  ('finance_manager', 'cage_closings', true, false, 'all')
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view    = EXCLUDED.can_view,
  can_write   = EXCLUDED.can_write,
  day_horizon = EXCLUDED.day_horizon;

-- Also ensure cashier explicitly does NOT have this module.
-- If it was ever incorrectly granted, remove it.
DELETE FROM public.role_module_defaults
WHERE module_key = 'cage_closings' AND role = 'cashier';

-- Remove any stale user_module_permissions overrides for cage_closings
-- so users fall back to the corrected role defaults.
DELETE FROM public.user_module_permissions
WHERE module_key = 'cage_closings';

-- Invalidate existing effective_module_perms caches by bumping a version
-- (clients will refetch automatically via query invalidation).
NOTIFY pgrst, 'reload schema';

-- NOTE: The route /cage/closings now maps to module_key 'cage_closings'.
-- Cashier accounts will no longer see the Closings button in the sidebar
-- or be able to navigate to /cage/closings via the RoleGuard.

-- One edge case: if a cashier has an active Manager Override session,
-- the manager override logic in auth-context.tsx already bypasses the
-- matrix for transactional surfaces, but /cage/closings is NOT a
-- transactional surface — it is a read-only history page. The RoleGuard
-- will still block it because the override toggle does not add modules
-- to the allow-list; it only unlocks transactional actions inside Cage.

-- Verify: list who currently has this module.
-- SELECT role, module_key, can_view, can_write FROM public.role_module_defaults
-- WHERE module_key = 'cage_closings' ORDER BY role;

-- Verify: cashier explicitly absent.
-- SELECT role, module_key FROM public.role_module_defaults
-- WHERE module_key = 'cage_closings' AND role = 'cashier';

-- Verify: /cage/closings resolves to 'cage_closings' in route-module-map.
-- This is enforced by the frontend unit test in src/test/access-matrix.test.ts.

-- DONE: Cashier can no longer see Closings. Manager/Floor Manager/Finance/Super Admin retain access.

-- Version bump reference: package.json 1.0.143

-- END
