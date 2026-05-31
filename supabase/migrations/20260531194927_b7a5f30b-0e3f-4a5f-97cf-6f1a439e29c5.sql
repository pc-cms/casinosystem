-- Remove cage_slots module access from manager and floor_manager roles
-- so they no longer see the "Cage Slots" sidebar button.
DELETE FROM public.role_module_defaults
WHERE module_key = 'cage_slots'
  AND role IN ('manager', 'floor_manager');