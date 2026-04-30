-- ─────────────────────────────────────────────────────────────
-- Casino System — initial Postgres roles for Supabase-stack
-- Создаются автоматически при первом запуске postgres контейнера
-- ─────────────────────────────────────────────────────────────

-- Роли совместимые с Supabase (PostgREST + GoTrue + Realtime)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authenticator';
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

-- Схемы
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS _realtime;

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Минимальный auth.uid() / auth.jwt() для совместимости с RLS политиками
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT current_setting('request.jwt.claim.role', true);
  $$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT current_setting('request.jwt.claim.email', true);
  $$;

GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
