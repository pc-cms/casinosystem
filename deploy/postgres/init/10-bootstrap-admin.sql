-- ─────────────────────────────────────────────────────────────
-- 10-bootstrap-admin.sql
-- ─────────────────────────────────────────────────────────────
-- DEPRECATED as a user-creator. Super admin is now created by
-- install.sh via the GoTrue admin API (superadmin@cms.local /
-- superadmin), which also UPSERTs profile+user_roles+casino_id.
--
-- This file is kept only as a no-op marker so older installs that
-- already ran it don't break, and so the init/ directory stays in
-- predictable lexical order (00-schema -> 01-roles -> 02-sync ->
-- 10-bootstrap -> 20-seed-defaults).
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '10-bootstrap-admin.sql: skipped (super admin is created by install.sh)';
END $$;
