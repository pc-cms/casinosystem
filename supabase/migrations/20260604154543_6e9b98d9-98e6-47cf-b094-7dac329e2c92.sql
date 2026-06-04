INSERT INTO public.user_roles (user_id, role) VALUES
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'super_admin'),
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'finance_manager'),
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'hr'),
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'pit'),
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'cashier'),
  ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'reception')
ON CONFLICT (user_id, role) DO NOTHING;