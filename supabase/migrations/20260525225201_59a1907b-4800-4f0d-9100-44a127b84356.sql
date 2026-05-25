-- Reassign slots@cms.local from 'cashier' to 'cashier_slots'
DELETE FROM public.user_roles
WHERE user_id = 'b2692fab-a5be-42cf-9e2f-1204bf85dcb0'
  AND role = 'cashier';

INSERT INTO public.user_roles (user_id, role)
VALUES ('b2692fab-a5be-42cf-9e2f-1204bf85dcb0', 'cashier_slots')
ON CONFLICT (user_id, role) DO NOTHING;