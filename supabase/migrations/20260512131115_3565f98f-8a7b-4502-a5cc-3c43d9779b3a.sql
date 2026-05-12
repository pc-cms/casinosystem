-- Day-horizon enum
DO $$ BEGIN
  CREATE TYPE day_horizon AS ENUM ('today','7d','30d','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Role baseline table
CREATE TABLE IF NOT EXISTS public.role_module_defaults (
  role app_role NOT NULL,
  module_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_write boolean NOT NULL DEFAULT false,
  day_horizon day_horizon NOT NULL DEFAULT 'today',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module_key)
);

ALTER TABLE public.role_module_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated read role defaults" ON public.role_module_defaults;
CREATE POLICY "All authenticated read role defaults"
ON public.role_module_defaults FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages role defaults" ON public.role_module_defaults;
CREATE POLICY "Super admin manages role defaults"
ON public.role_module_defaults FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Per-user override columns
ALTER TABLE public.user_module_permissions
  ADD COLUMN IF NOT EXISTS can_write boolean,
  ADD COLUMN IF NOT EXISTS day_horizon day_horizon;

-- Effective merged permissions RPC
CREATE OR REPLACE FUNCTION public.effective_module_perms(p_user_id uuid)
RETURNS TABLE (module_key text, can_view boolean, can_write boolean, day_horizon day_horizon)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    COALESCE(o.day_horizon, r.day_horizon, 'today'::day_horizon) AS day_horizon
  FROM role_merge r
  FULL OUTER JOIN ovr o ON o.module_key = r.module_key;
$$;

REVOKE EXECUTE ON FUNCTION public.effective_module_perms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_module_perms(uuid) TO authenticated;

-- Seed defaults
DELETE FROM public.role_module_defaults;

INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon) VALUES
-- super_admin
('super_admin','dashboard',true,true,'all'),('super_admin','pit_rota',true,true,'all'),
('super_admin','pit_breaklist',true,true,'all'),('super_admin','pit_attendance',true,true,'all'),
('super_admin','pit_active_players',true,true,'all'),('super_admin','cage',true,true,'all'),
('super_admin','tables',true,true,'all'),('super_admin','table_tracker',true,true,'all'),
('super_admin','players',true,true,'all'),('super_admin','blacklist',true,true,'all'),
('super_admin','reception',true,true,'all'),('super_admin','in_casino',true,true,'all'),
('super_admin','bank_checks',true,true,'all'),('super_admin','expenses',true,true,'all'),
('super_admin','finance_dashboard',true,true,'all'),('super_admin','finance_wallets',true,true,'all'),
('super_admin','finance_cash_count',true,true,'all'),('super_admin','finance_budget',true,true,'all'),
('super_admin','finance_review',true,true,'all'),('super_admin','finance_transfers',true,true,'all'),
('super_admin','finance_summary',true,true,'all'),('super_admin','reports',true,true,'all'),
('super_admin','miss_chips',true,true,'all'),('super_admin','groups',true,true,'all'),
('super_admin','staff',true,true,'all'),('super_admin','logs',true,false,'all'),
('super_admin','cctv',true,true,'all'),('super_admin','import_reports',true,true,'all'),
('super_admin','admin',true,true,'all'),

-- finance_manager
('finance_manager','dashboard',true,false,'all'),('finance_manager','pit_rota',true,false,'all'),
('finance_manager','pit_breaklist',true,false,'all'),('finance_manager','pit_attendance',true,false,'all'),
('finance_manager','pit_active_players',true,false,'all'),('finance_manager','cage',true,false,'all'),
('finance_manager','tables',true,false,'all'),('finance_manager','table_tracker',true,false,'all'),
('finance_manager','players',true,false,'all'),('finance_manager','blacklist',true,false,'all'),
('finance_manager','reception',true,false,'all'),('finance_manager','in_casino',true,false,'all'),
('finance_manager','bank_checks',true,true,'all'),('finance_manager','expenses',true,true,'all'),
('finance_manager','finance_dashboard',true,true,'all'),('finance_manager','finance_wallets',true,true,'all'),
('finance_manager','finance_cash_count',true,true,'all'),('finance_manager','finance_budget',true,true,'all'),
('finance_manager','finance_review',true,true,'all'),('finance_manager','finance_transfers',true,true,'all'),
('finance_manager','finance_summary',true,true,'all'),('finance_manager','reports',true,false,'all'),
('finance_manager','miss_chips',true,false,'all'),('finance_manager','groups',true,false,'all'),
('finance_manager','logs',true,false,'all'),

-- manager
('manager','dashboard',true,true,'all'),('manager','pit_rota',true,true,'all'),
('manager','pit_breaklist',true,true,'all'),('manager','pit_attendance',true,true,'all'),
('manager','pit_active_players',true,true,'all'),('manager','cage',true,false,'all'),
('manager','tables',true,true,'all'),('manager','table_tracker',true,true,'all'),
('manager','players',true,true,'all'),('manager','blacklist',true,true,'all'),
('manager','reception',true,true,'all'),('manager','in_casino',true,true,'all'),
('manager','bank_checks',true,true,'all'),('manager','expenses',true,true,'all'),
('manager','finance_dashboard',true,true,'all'),('manager','finance_wallets',true,true,'all'),
('manager','finance_cash_count',true,true,'all'),('manager','finance_budget',true,true,'all'),
('manager','finance_review',true,true,'all'),('manager','reports',true,false,'all'),
('manager','miss_chips',true,false,'all'),('manager','groups',true,true,'all'),
('manager','staff',true,true,'all'),('manager','logs',true,false,'all'),
('manager','cctv',true,false,'all'),('manager','import_reports',true,true,'all'),
('manager','admin',true,true,'all'),

-- floor_manager
('floor_manager','dashboard',true,false,'all'),('floor_manager','pit_rota',true,true,'all'),
('floor_manager','pit_breaklist',true,true,'all'),('floor_manager','pit_attendance',true,true,'all'),
('floor_manager','pit_active_players',true,false,'all'),('floor_manager','cage',true,false,'today'),
('floor_manager','tables',true,true,'all'),('floor_manager','table_tracker',true,true,'all'),
('floor_manager','players',true,true,'all'),('floor_manager','blacklist',true,true,'all'),
('floor_manager','reception',true,true,'all'),('floor_manager','in_casino',true,false,'all'),
('floor_manager','miss_chips',true,false,'30d'),('floor_manager','reports',true,false,'30d'),
('floor_manager','staff',true,false,'all'),('floor_manager','logs',true,false,'7d'),

-- pit
('pit','dashboard',true,false,'today'),('pit','pit_rota',true,true,'today'),
('pit','pit_breaklist',true,true,'today'),('pit','pit_attendance',true,true,'today'),
('pit','pit_active_players',true,false,'today'),('pit','tables',true,true,'today'),
('pit','table_tracker',true,true,'today'),('pit','players',true,true,'today'),
('pit','in_casino',true,false,'today'),

-- cashier
('cashier','cage',true,true,'today'),('cashier','expenses',true,true,'today'),
('cashier','reception',true,true,'today'),

-- reception
('reception','dashboard',true,false,'today'),('reception','reception',true,true,'today'),
('reception','in_casino',true,false,'today'),('reception','blacklist',true,true,'all'),
('reception','players',true,false,'today'),

-- surveillance
('surveillance','dashboard',true,false,'all'),('surveillance','pit_rota',true,false,'all'),
('surveillance','pit_breaklist',true,false,'today'),('surveillance','pit_attendance',true,false,'all'),
('surveillance','pit_active_players',true,false,'all'),('surveillance','cage',true,false,'today'),
('surveillance','tables',true,false,'all'),('surveillance','table_tracker',true,false,'all'),
('surveillance','players',true,false,'all'),('surveillance','blacklist',true,false,'all'),
('surveillance','in_casino',true,false,'all'),('surveillance','reports',true,false,'all'),
('surveillance','cctv',true,true,'all'),

-- hr
('hr','pit_rota',true,true,'all'),('hr','pit_attendance',true,true,'all'),
('hr','staff',true,true,'all');