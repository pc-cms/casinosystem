-- Restrict Cage Slots module to per-user grants only.
-- 1) Remove all role-level defaults so no role sees it by default.
DELETE FROM public.role_module_defaults
WHERE module_key = 'cage_slots';

-- 2) If a user named "Slots" already exists, grant them explicit view/write access.
INSERT INTO public.user_module_permissions (user_id, module_key, can_view, can_write, day_horizon)
SELECT p.user_id, 'cage_slots', true, true, 'all'::public.day_horizon
FROM public.profiles p
WHERE p.display_name = 'Slots'
ON CONFLICT (user_id, module_key) DO UPDATE
  SET can_view = true, can_write = true, day_horizon = 'all'::public.day_horizon;