DELETE FROM public.user_roles
WHERE user_id = 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c'
  AND role::text <> 'account_manager';

INSERT INTO public.user_roles (user_id, role)
SELECT 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'account_manager'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id='d3d6a508-b227-46c0-8ad2-1649f42c9f5c' AND role::text='account_manager'
);

INSERT INTO public.user_casino_access (user_id, casino_id, granted_by)
SELECT 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c', id, 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c'
FROM public.casinos
ON CONFLICT DO NOTHING;