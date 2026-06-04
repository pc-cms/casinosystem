INSERT INTO public.user_module_permissions (user_id, module_key, can_view, can_write, day_horizon)
SELECT 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c', module_key, true, true, 'all'::day_horizon
FROM public.effective_module_perms('d3d6a508-b227-46c0-8ad2-1649f42c9f5c')
ON CONFLICT (user_id, module_key) DO UPDATE 
  SET can_view = true, can_write = true, day_horizon = 'all'::day_horizon;