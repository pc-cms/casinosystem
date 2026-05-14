DELETE FROM public.role_module_defaults WHERE role='pit' AND module_key IN ('cage_view','in_casino','pit_dealers','staff_employees');
-- Also drop any per-user overrides granting these to pit users
DELETE FROM public.user_module_permissions
WHERE module_key IN ('cage_view','in_casino','pit_dealers','staff_employees')
  AND user_id IN (SELECT user_id FROM public.user_roles WHERE role='pit');