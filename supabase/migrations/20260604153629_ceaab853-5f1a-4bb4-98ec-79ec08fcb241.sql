-- Setup amanager user: profile + account_manager role + AM budget seed
UPDATE public.profiles 
SET casino_id = '48f4404f-7724-418c-8365-29af3998e113', display_name = 'Account Manager'
WHERE user_id = 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c';

INSERT INTO public.profiles (user_id, casino_id, display_name)
SELECT 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c', '48f4404f-7724-418c-8365-29af3998e113', 'Account Manager'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id='d3d6a508-b227-46c0-8ad2-1649f42c9f5c');

DELETE FROM public.user_roles WHERE user_id = 'd3d6a508-b227-46c0-8ad2-1649f42c9f5c';
INSERT INTO public.user_roles (user_id, role) VALUES ('d3d6a508-b227-46c0-8ad2-1649f42c9f5c', 'account_manager');

-- Seed sensible role_module_defaults for account_manager if missing.
-- AM sees: own players (CRM), promo grants/codes, AM budget, AM performance, lotteries, shop orders.
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
SELECT 'account_manager', m.key, m.v, m.w, 'all'::day_horizon
FROM (VALUES
  ('dashboard', true, false),
  ('crm_players', true, true),
  ('promo_grants', true, true),
  ('promo_codes', true, true),
  ('am_budget', true, false),
  ('am_performance', true, false),
  ('lotteries', true, false),
  ('shop_orders', true, false),
  ('shop_catalog', true, false),
  ('marketing_campaigns', true, true),
  ('players', true, true),
  ('in_casino', true, false),
  ('visits', true, false)
) AS m(key, v, w)
ON CONFLICT (role, module_key) DO NOTHING;