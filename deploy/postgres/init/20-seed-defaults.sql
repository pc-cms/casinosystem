-- ─────────────────────────────────────────────────────────────
-- Casino System — default seed data for fresh local installs
-- Runs once on empty postgres volume, AFTER 00-schema.sql.
-- Idempotent (ON CONFLICT DO NOTHING) — safe to re-run on
-- migrated environments via \i 20-seed-defaults.sql.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Placeholder casino (deterministic UUID, user renames via UI) ──
INSERT INTO public.casinos (id, name, code, slug, timezone, chip_conservation_mode)
VALUES (
  '00000000-0000-0000-0000-0000000000ca',
  'Local Casino', 'LOCAL', 'local',
  'Africa/Dar_es_Salaam', 'strict'
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Role × Module permissions matrix (network-wide, not casino-scoped) ──
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('cashier'::app_role, 'cage', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('cashier'::app_role, 'cashless', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('cashier'::app_role, 'expenses', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('cashier'::app_role, 'reception', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('cashier'::app_role, 'reception_register', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'dashboard', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'expenses_approvals', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'incidents', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'pit_active_players', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'pit_attendance', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'pit_breaklist', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'pit_rota', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'pitbook', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'players', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'staff_attendance', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'staff_rota', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'table_tracker', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'tables', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('pit'::app_role, 'tables_analytics', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'admin', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'bank_checks', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'blacklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'business_days', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'cage', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'cage_closings', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'cage_view', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'cashless', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'cctv', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'dashboard', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'expenses', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'expenses_approvals', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_budget', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_cash_count', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_dashboard', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_payments', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_review', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'finance_wallets', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'groups', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'import_reports', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'in_casino', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'incidents', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'logs', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'miss_chips', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pit_active_players', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pit_attendance', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pit_breaklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pit_dealers', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pit_rota', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'pitbook', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'players', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'reception', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'reception_checkin', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'reception_register', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'reception_update', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'reports', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'staff', false, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'staff_attendance', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'staff_employees', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'staff_rota', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'table_results', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'table_tracker', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'tables', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'tables_analytics', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('manager'::app_role, 'weekly_bonus', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'blacklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'dashboard', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'in_casino', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'players', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'reception', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'reception_checkin', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'reception_register', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('reception'::app_role, 'reception_update', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'bank_checks', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'blacklist', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'business_days', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'cage', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'cage_closings', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'cage_view', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'cashless', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'dashboard', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'expenses', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'expenses_approvals', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_budget', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_cash_count', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_dashboard', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_payments', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_review', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_summary', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_transfers', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'finance_wallets', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'groups', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'in_casino', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'incidents', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'logs', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'miss_chips', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'payroll', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pit_active_players', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pit_attendance', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pit_breaklist', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pit_dealers', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pit_rota', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'pitbook', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'players', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'reception', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'reception_checkin', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'reception_register', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'reception_update', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'reports', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'staff_attendance', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'staff_employees', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'staff_master', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'staff_rota', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'table_results', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'table_tracker', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'tables', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'tables_analytics', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('finance_manager'::app_role, 'weekly_bonus', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'blacklist', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'cage', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'cage_view', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'cctv', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'cctv_dashboard', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'dashboard', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'groups', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'in_casino', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'incidents', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pit_active_players', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pit_attendance', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pit_breaklist', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pit_dealers', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pit_rota', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'pitbook', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'players', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'reports', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'table_results', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'table_tracker', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'tables', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('surveillance'::app_role, 'tables_analytics', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'admin', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'bank_checks', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'blacklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'business_days', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cage', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cage_closings', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cage_view', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cashless', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cctv', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'cctv_dashboard', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'dashboard', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'expenses', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'expenses_approvals', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_budget', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_cash_count', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_dashboard', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_payments', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_review', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_summary', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_transfers', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'finance_wallets', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'groups', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'import_reports', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'in_casino', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'incidents', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'logs', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'miss_chips', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pit_active_players', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pit_attendance', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pit_breaklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pit_dealers', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pit_rota', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'pitbook', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'players', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'reception', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'reception_checkin', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'reception_register', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'reception_update', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'reports', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'staff', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'staff_attendance', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'staff_employees', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'staff_rota', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'table_results', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'table_tracker', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'tables', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'tables_analytics', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('super_admin'::app_role, 'weekly_bonus', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'payroll', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'pit_attendance', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'pit_dealers', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'pit_rota', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'staff', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'staff_attendance', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'staff_employees', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'staff_master', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('hr'::app_role, 'staff_rota', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'bank_checks', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'blacklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'business_days', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'cage', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'cage_closings', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'cage_view', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'cashless', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'dashboard', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'expenses', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'expenses_approvals', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'in_casino', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'incidents', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'logs', false, false, '7d'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'miss_chips', true, false, '30d'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pit_active_players', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pit_attendance', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pit_breaklist', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pit_dealers', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pit_rota', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'pitbook', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'players', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'reception', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'reception_checkin', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'reception_register', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'reception_update', true, true, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'reports', true, false, '30d'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'staff', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'staff_attendance', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'staff_employees', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'staff_rota', true, false, 'today'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'table_results', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'table_tracker', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'tables', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'tables_analytics', true, false, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES ('floor_manager'::app_role, 'weekly_bonus', true, true, 'all'::day_horizon) ON CONFLICT (role, module_key) DO NOTHING;

-- ── 3. Financial wallets for placeholder casino (zero balance, manager seeds real money) ──
INSERT INTO public.financial_wallets (casino_id, wallet_type, current_balance)
SELECT '00000000-0000-0000-0000-0000000000ca'::uuid, w, 0
FROM unnest(ARRAY[
  'main_cash','office_safe','rent_reserve','license_reserve','tax_reserve',
  'other_reserve','cage_slot','cage_table','mobile_money','bank_account'
]::wallet_type[]) AS w
ON CONFLICT DO NOTHING;

-- ── 4. Default chip colors (11 standard TZS denominations) ──
INSERT INTO public.chip_color_settings (casino_id, denomination, bg_color, text_color, edge_color) VALUES
  ('00000000-0000-0000-0000-0000000000ca', 5000000, '#837c7e', '#000000', '#888686'),
  ('00000000-0000-0000-0000-0000000000ca', 1000000, '#ffffff', '#000000', '#c91818'),
  ('00000000-0000-0000-0000-0000000000ca',  500000, '#1b1d1d', '#FFFFFF', '#FFFFFF'),
  ('00000000-0000-0000-0000-0000000000ca',  100000, '#dee119', '#000000', '#787878'),
  ('00000000-0000-0000-0000-0000000000ca',   50000, '#18abdc', '#000000', '#0c79ed'),
  ('00000000-0000-0000-0000-0000000000ca',   25000, '#b2bacd', '#000000', '#868383'),
  ('00000000-0000-0000-0000-0000000000ca',   10000, '#f2bad5', '#000000', '#e39426'),
  ('00000000-0000-0000-0000-0000000000ca',    5000, '#ca0742', '#FFFFFF', '#000000'),
  ('00000000-0000-0000-0000-0000000000ca',    2000, '#18abdc', '#000000', '#000000'),
  ('00000000-0000-0000-0000-0000000000ca',    1000, '#20b188', '#000000', '#030303'),
  ('00000000-0000-0000-0000-0000000000ca',     500, '#e279d9', '#000000', '#050505')
ON CONFLICT DO NOTHING;

-- ── 5. Standard gaming tables (zero float, status=open, archived=false) ──
-- Manager renames / archives / adds via Admin → Tables. Floats are filled by
-- the cashier on shift open. These are just the typical layout for a small
-- floor — six tables covering Blackjack, Roulette, Poker. Names are unique
-- per casino, ON CONFLICT skip avoids duplicates on re-run.
INSERT INTO public.gaming_tables (casino_id, name, game, status, float_amount, denominations, is_archived)
SELECT '00000000-0000-0000-0000-0000000000ca'::uuid, t.name, t.game, 'open'::table_status, 0, t.denoms, false
FROM (VALUES
  ('BJ1', 'Blackjack',         ARRAY[500,1000,2000,5000,10000,25000,50000,100000]),
  ('BJ2', 'Blackjack',         ARRAY[500,1000,2000,5000,10000,25000,50000,100000]),
  ('BJ3', 'Blackjack',         ARRAY[500,1000,2000,5000,10000,25000,50000,100000]),
  ('AR1', 'American Roulette', ARRAY[500,1000,2000,5000,10000,25000,50000,100000,500000]),
  ('AR2', 'American Roulette', ARRAY[500,1000,2000,5000,10000,25000,50000,100000,500000]),
  ('P1',  'Texas Holdem',      ARRAY[500,1000,2000,5000,10000,25000,50000,100000])
) AS t(name, game, denoms)
WHERE NOT EXISTS (
  SELECT 1 FROM public.gaming_tables g
  WHERE g.casino_id = '00000000-0000-0000-0000-0000000000ca'::uuid
    AND g.name = t.name
);

-- ── 6. Player tag conflict rules (network-wide validation) ──
INSERT INTO public.tag_conflicts (tag_a, tag_b) VALUES
  ('No Alcohol', 'Free Drinks'),
  ('VIP',        'Watch List'),
  ('Free Food',  'No Food')
ON CONFLICT (tag_a, tag_b) DO NOTHING;

-- ── 7. Finance / Budget categories for placeholder casino ──
-- created_by uses a system UUID (no FK to auth.users on this column).
-- Manager / Finance can edit these later in Admin → Finance → Categories.
INSERT INTO public.budget_categories (casino_id, name, parent_group, expense_mapping, created_by)
SELECT '00000000-0000-0000-0000-0000000000ca'::uuid, c.name, c.grp, c.mapping, '00000000-0000-0000-0000-000000000001'::uuid
FROM (VALUES
  -- operating
  ('Salary',          'operating',  'salary'),
  ('Bonus',           'operating',  'bonus'),
  ('Fuel',            'operating',  'fuel'),
  ('Transport',       'operating',  'transport'),
  ('Repairs',         'operating',  'repairs'),
  ('Internet & IT',   'operating',  'internet_it'),
  ('Security',        'operating',  'security_expense'),
  ('Cleaning',        'operating',  'cleaning'),
  ('Office Supplies', 'operating',  'office'),
  -- fixed
  ('Rent',            'fixed',      'rent'),
  ('Utilities',       'fixed',      'utilities'),
  -- government
  ('Gaming Tax',      'government', 'gaming_tax'),
  ('Fixed Tax',       'government', 'fixed_tax'),
  ('License',         'government', 'license'),
  ('Visa',            'government', 'visa'),
  -- tech
  ('Machines',        'tech',       'machines'),
  ('Parts',           'tech',       'parts'),
  -- other
  ('Debts',           'other',      'debts'),
  ('Adjustments',     'other',      'adjustments'),
  ('Other Office',    'other',      'other_office')
) AS c(name, grp, mapping)
ON CONFLICT (casino_id, name) DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Seed defaults applied: placeholder casino + roles matrix + wallets + chip colors + tables + tag conflicts + budget categories'; END $$;
