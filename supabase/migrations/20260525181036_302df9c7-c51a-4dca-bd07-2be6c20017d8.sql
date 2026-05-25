-- Deny cage / expenses / cashless for the Slots cashier so they only see Cage Slots
INSERT INTO public.user_module_permissions (user_id, module_key, can_view, can_write, day_horizon, granted_by)
VALUES
  ('b2692fab-a5be-42cf-9e2f-1204bf85dcb0', 'cage',     false, false, 'today', 'bf328d89-bf0a-46ab-ae1e-9b4914cc9811'),
  ('b2692fab-a5be-42cf-9e2f-1204bf85dcb0', 'expenses', false, false, 'today', 'bf328d89-bf0a-46ab-ae1e-9b4914cc9811'),
  ('b2692fab-a5be-42cf-9e2f-1204bf85dcb0', 'cashless', false, false, 'today', 'bf328d89-bf0a-46ab-ae1e-9b4914cc9811')
ON CONFLICT (user_id, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      updated_at = now();