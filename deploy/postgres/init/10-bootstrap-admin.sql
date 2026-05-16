-- Bootstrap: seeds the single super_admin user on a fresh empty install.
-- Runs AFTER the schema dump (00-schema.sql) has populated all tables/triggers.
-- Idempotent — safe to re-run.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_email   text := 'admin@local';
  -- bcrypt of "Welcome6407!" (cost 10). Pre-computed so we don't need pgcrypto extras.
  v_hash    text := '$2a$10$Q.0bGqB7L8/oBfzZpDJZQ.HfQZ1pHRdLpZpD3p1lQF3K9YJfQ9X0e';
BEGIN
  -- 1. auth.users (GoTrue's schema)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_email,
      v_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Local Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  -- 2. public.user_roles → super_admin
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='user_roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Bootstrap admin ready: % / Welcome6407!', v_email;
END $$;
