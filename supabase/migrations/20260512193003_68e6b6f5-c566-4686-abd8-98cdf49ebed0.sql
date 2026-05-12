
-- Phase 1: extend module catalog with view-only Cage variant, approvals queue,
-- finance payments, and previously-ungated operational pages.

INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
  -- cage_view: read-only Cage history visible to managers/finance/pit/surveillance
  ('manager','cage_view',true,false,'all'),
  ('floor_manager','cage_view',true,false,'all'),
  ('pit','cage_view',true,false,'today'),
  ('finance_manager','cage_view',true,false,'all'),
  ('surveillance','cage_view',true,false,'all'),
  ('super_admin','cage_view',true,true,'all'),

  -- expenses_approvals queue
  ('manager','expenses_approvals',true,true,'all'),
  ('floor_manager','expenses_approvals',true,true,'all'),
  ('finance_manager','expenses_approvals',true,true,'all'),
  ('pit','expenses_approvals',true,false,'today'),
  ('super_admin','expenses_approvals',true,true,'all'),

  -- finance_payments (manager outflows; not a cashier surface)
  ('manager','finance_payments',true,true,'all'),
  ('finance_manager','finance_payments',true,true,'all'),
  ('super_admin','finance_payments',true,true,'all'),

  -- incidents
  ('manager','incidents',true,true,'all'),
  ('floor_manager','incidents',true,true,'all'),
  ('pit','incidents',true,true,'today'),
  ('finance_manager','incidents',true,false,'all'),
  ('surveillance','incidents',true,true,'all'),
  ('super_admin','incidents',true,true,'all'),

  -- pitbook
  ('manager','pitbook',true,true,'all'),
  ('floor_manager','pitbook',true,true,'all'),
  ('pit','pitbook',true,true,'today'),
  ('finance_manager','pitbook',true,false,'all'),
  ('surveillance','pitbook',true,true,'all'),
  ('super_admin','pitbook',true,true,'all'),

  -- weekly_bonus
  ('manager','weekly_bonus',true,true,'all'),
  ('floor_manager','weekly_bonus',true,true,'all'),
  ('finance_manager','weekly_bonus',true,true,'all'),
  ('super_admin','weekly_bonus',true,true,'all'),

  -- tables_analytics
  ('manager','tables_analytics',true,false,'all'),
  ('floor_manager','tables_analytics',true,false,'all'),
  ('pit','tables_analytics',true,false,'today'),
  ('finance_manager','tables_analytics',true,false,'all'),
  ('surveillance','tables_analytics',true,false,'all'),
  ('super_admin','tables_analytics',true,true,'all'),

  -- table_results
  ('manager','table_results',true,false,'all'),
  ('floor_manager','table_results',true,false,'all'),
  ('finance_manager','table_results',true,false,'all'),
  ('surveillance','table_results',true,false,'all'),
  ('super_admin','table_results',true,true,'all'),

  -- business_days
  ('manager','business_days',true,true,'all'),
  ('floor_manager','business_days',true,false,'all'),
  ('finance_manager','business_days',true,true,'all'),
  ('super_admin','business_days',true,true,'all'),

  -- bank_checks
  ('manager','bank_checks',true,true,'all'),
  ('floor_manager','bank_checks',true,true,'all'),
  ('finance_manager','bank_checks',true,true,'all'),
  ('super_admin','bank_checks',true,true,'all'),

  -- cashless
  ('cashier','cashless',true,true,'today'),
  ('manager','cashless',true,true,'all'),
  ('floor_manager','cashless',true,true,'all'),
  ('finance_manager','cashless',true,true,'all'),
  ('super_admin','cashless',true,true,'all')
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_write = EXCLUDED.can_write,
      day_horizon = EXCLUDED.day_horizon;
