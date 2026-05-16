-- Casino System — local compatibility repair
-- Idempotent patch for on-prem nodes that were installed before the
-- editable access matrix / disabled-user columns existed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('cashier', 'pit', 'manager', 'reception');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'surveillance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'floor_manager';

DO $$ BEGIN
  CREATE TYPE public.day_horizon AS ENUM ('today','7d','30d','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.casinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Local Casino',
  code text NOT NULL DEFAULT 'LOCAL',
  timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS chip_conservation_mode text NOT NULL DEFAULT 'strict';

INSERT INTO public.casinos (id, name, code, slug, timezone)
VALUES ('00000000-0000-0000-0000-0000000000ca', 'Local Casino', 'LOCAL', 'local', 'Africa/Dar_es_Salaam')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  casino_id uuid,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS casino_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_disabled_at ON public.profiles(disabled_at);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_casino_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT casino_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.user_casino_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  casino_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_casino_access
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS casino_id uuid,
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS user_casino_access_user_casino_key
  ON public.user_casino_access(user_id, casino_id);

CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  can_view boolean,
  can_write boolean,
  day_horizon public.day_horizon,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

ALTER TABLE public.user_module_permissions
  ADD COLUMN IF NOT EXISTS can_write boolean,
  ADD COLUMN IF NOT EXISTS day_horizon public.day_horizon;
ALTER TABLE public.user_module_permissions ALTER COLUMN can_view DROP NOT NULL;
ALTER TABLE public.user_module_permissions ALTER COLUMN can_write DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.role_module_defaults (
  role public.app_role NOT NULL,
  module_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_write boolean NOT NULL DEFAULT false,
  day_horizon public.day_horizon NOT NULL DEFAULT 'today',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module_key)
);

CREATE OR REPLACE FUNCTION public.effective_module_perms(p_user_id uuid)
RETURNS TABLE (module_key text, can_view boolean, can_write boolean, day_horizon public.day_horizon)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ur AS (
    SELECT role FROM public.user_roles WHERE user_id = p_user_id
  ),
  role_merge AS (
    SELECT
      d.module_key,
      bool_or(d.can_view)  AS can_view,
      bool_or(d.can_write) AS can_write,
      (ARRAY_AGG(d.day_horizon ORDER BY
        CASE d.day_horizon WHEN 'all' THEN 4 WHEN '30d' THEN 3 WHEN '7d' THEN 2 ELSE 1 END DESC))[1]
        AS day_horizon
    FROM public.role_module_defaults d
    JOIN ur ON ur.role = d.role
    GROUP BY d.module_key
  ),
  ovr AS (
    SELECT module_key, can_view, can_write, day_horizon
    FROM public.user_module_permissions
    WHERE user_id = p_user_id
  )
  SELECT
    COALESCE(o.module_key, r.module_key) AS module_key,
    COALESCE(o.can_view,  r.can_view,  false) AS can_view,
    COALESCE(o.can_write, r.can_write, false) AS can_write,
    COALESCE(o.day_horizon, r.day_horizon, 'today'::public.day_horizon) AS day_horizon
  FROM role_merge r
  FULL OUTER JOIN ovr o ON o.module_key = r.module_key;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_casino_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own casino access" ON public.user_casino_access;
CREATE POLICY "Users read own casino access" ON public.user_casino_access
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Global roles read casino access" ON public.user_casino_access;
CREATE POLICY "Global roles read casino access" ON public.user_casino_access
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
);

DROP POLICY IF EXISTS "All authenticated read role defaults" ON public.role_module_defaults;
CREATE POLICY "All authenticated read role defaults" ON public.role_module_defaults
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users read own module permissions" ON public.user_module_permissions;
CREATE POLICY "Users read own module permissions" ON public.user_module_permissions
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins manage module permissions" ON public.user_module_permissions;
CREATE POLICY "Super admins manage module permissions" ON public.user_module_permissions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON public.casinos, public.profiles, public.user_roles, public.user_casino_access,
      public.role_module_defaults, public.user_module_permissions TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_user_casino_id(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.effective_module_perms(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.casinos, public.profiles, public.user_roles, public.user_casino_access,
      public.role_module_defaults, public.user_module_permissions TO service_role;
  END IF;
END $$;

DO $$
DECLARE
  v_sa uuid;
  v_casino uuid;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_sa FROM auth.users WHERE email = 'superadmin@cms.local' LIMIT 1;
  SELECT COALESCE(
    (SELECT casino_id FROM public.profiles WHERE user_id = v_sa LIMIT 1),
    (SELECT id FROM public.casinos WHERE slug = 'local' LIMIT 1),
    (SELECT id FROM public.casinos ORDER BY created_at LIMIT 1),
    '00000000-0000-0000-0000-0000000000ca'::uuid
  ) INTO v_casino;

  IF v_sa IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_sa, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.profiles (user_id, casino_id, display_name)
    VALUES (v_sa, v_casino, 'Super Admin')
    ON CONFLICT (user_id) DO UPDATE
      SET casino_id = COALESCE(public.profiles.casino_id, EXCLUDED.casino_id),
          display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name);

    INSERT INTO public.user_casino_access (user_id, casino_id, granted_by)
    VALUES (v_sa, v_casino, v_sa)
    ON CONFLICT (user_id, casino_id) DO NOTHING;
  END IF;
END $$;

-- ── cloud_connection: required by pair-cli.js ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.cloud_connection (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cloud_url text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','pairing','connected')),
  pairing_id uuid,
  pairing_code text,
  pairing_expires_at timestamptz,
  casino_id uuid,
  sync_secret text,
  connected_at timestamptz,
  last_polled_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.cloud_connection (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cloud_connection_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cloud_connection_touch ON public.cloud_connection;
CREATE TRIGGER trg_cloud_connection_touch
  BEFORE UPDATE ON public.cloud_connection
  FOR EACH ROW EXECUTE FUNCTION public.cloud_connection_touch();

NOTIFY pgrst, 'reload schema';