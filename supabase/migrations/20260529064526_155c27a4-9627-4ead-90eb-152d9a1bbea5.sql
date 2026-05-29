
-- ============================================================
-- POS Module — M0 Schema, Roles, RLS, Triggers
-- ============================================================

-- 1) Roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pos_waiter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pos_bartender';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pos_manager';

-- 2) Expense category for POS comps
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'pos_comp';

-- 3) Enums for POS
DO $$ BEGIN
  CREATE TYPE public.pos_payment_mode AS ENUM ('cash','card','comp_player','comp_house');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pos_order_status AS ENUM ('pending','preparing','ready','served','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
