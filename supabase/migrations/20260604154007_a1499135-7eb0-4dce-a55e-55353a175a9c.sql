INSERT INTO public.user_roles (user_id, role)
VALUES ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;