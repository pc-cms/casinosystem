-- Remove legacy per-user denials for the unified /expenses page.
-- Before unification, /expenses was live-cashier-only, so some cashier_slots
-- users had explicit can_view=false overrides. Now that the page serves all
-- cashier roles (source auto-locked), these overrides mask the role baseline.
DELETE FROM public.user_module_permissions
WHERE module_key = 'expenses'
  AND user_id IN (
    SELECT user_id FROM public.user_roles
    WHERE role IN ('cashier', 'cashier_slots')
  );

-- The daily_expenses module no longer maps to any page (route redirects to /expenses).
-- Clean all stale overrides on it.
DELETE FROM public.user_module_permissions
WHERE module_key = 'daily_expenses';