
-- ============================================================
-- PREMIER CLUB P1: main schema (account_manager enum already added)
-- ============================================================

-- Players: verification fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='player_verification_status') THEN
    CREATE TYPE public.player_verification_status AS ENUM ('unverified','verified','rejected');
  END IF;
END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS verification_status public.player_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS am_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS am_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.chip_color_settings
  ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false;

-- ============================================================
-- CLUB ACCOUNTS + OTP
-- ============================================================
CREATE TABLE IF NOT EXISTS public.club_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  totp_secret_enc text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.club_accounts TO authenticated;
GRANT ALL ON public.club_accounts TO service_role;
ALTER TABLE public.club_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM and admins manage club_accounts" ON public.club_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Reception/cashier read club_accounts" ON public.club_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE IF NOT EXISTS public.club_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.club_otp_codes(phone, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.club_otp_codes TO authenticated;
GRANT ALL ON public.club_otp_codes TO service_role;
ALTER TABLE public.club_otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only OTP" ON public.club_otp_codes FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ============================================================
-- KYC REVIEWS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='kyc_review_source') THEN
    CREATE TYPE public.kyc_review_source AS ENUM ('reception','club');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='kyc_review_status') THEN
    CREATE TYPE public.kyc_review_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.kyc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  source public.kyc_review_source NOT NULL,
  status public.kyc_review_status NOT NULL DEFAULT 'pending',
  ai_result jsonb,
  am_user_id uuid,
  am_decision_at timestamptz,
  am_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_reviews(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.kyc_reviews TO authenticated;
GRANT ALL ON public.kyc_reviews TO service_role;
ALTER TABLE public.kyc_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM and admin manage kyc" ON public.kyc_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Reception/cashier create kyc" ON public.kyc_reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'cashier'));

-- ============================================================
-- FUNDING POOLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.house_promo_fund (
  casino_id uuid PRIMARY KEY REFERENCES public.casinos(id),
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.house_promo_fund TO authenticated;
GRANT ALL ON public.house_promo_fund TO service_role;
ALTER TABLE public.house_promo_fund ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FM/admin manage house fund" ON public.house_promo_fund FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'account_manager'))
  WITH CHECK (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.house_promo_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hpl_casino ON public.house_promo_ledger(casino_id, created_at DESC);
GRANT SELECT, INSERT ON public.house_promo_ledger TO authenticated;
GRANT ALL ON public.house_promo_ledger TO service_role;
ALTER TABLE public.house_promo_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read house ledger" ON public.house_promo_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'account_manager'));
CREATE POLICY "Insert house ledger" ON public.house_promo_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'account_manager'));

CREATE TABLE IF NOT EXISTS public.am_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  am_user_id uuid NOT NULL,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (am_user_id, casino_id)
);
GRANT SELECT, INSERT, UPDATE ON public.am_budgets TO authenticated;
GRANT ALL ON public.am_budgets TO service_role;
ALTER TABLE public.am_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FM/admin/AM read am_budgets" ON public.am_budgets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR (public.has_role(auth.uid(),'account_manager') AND am_user_id = auth.uid()));
CREATE POLICY "FM/admin write am_budgets" ON public.am_budgets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.am_budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  am_user_id uuid NOT NULL,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abl_am ON public.am_budget_ledger(am_user_id, casino_id, created_at DESC);
GRANT SELECT, INSERT ON public.am_budget_ledger TO authenticated;
GRANT ALL ON public.am_budget_ledger TO service_role;
ALTER TABLE public.am_budget_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read am_budget_ledger" ON public.am_budget_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR (public.has_role(auth.uid(),'account_manager') AND am_user_id = auth.uid()));
CREATE POLICY "Insert am_budget_ledger" ON public.am_budget_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'finance_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'account_manager'));

-- ============================================================
-- PROMO CAMPAIGNS (Premier Club) + CODES
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='promo_campaign_scope') THEN
    CREATE TYPE public.promo_campaign_scope AS ENUM ('reception_verify','club_verify','code','manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='promo_funding_source') THEN
    CREATE TYPE public.promo_funding_source AS ENUM ('house','am_budget','campaign_budget');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='promo_grant_lifetime_mode') THEN
    CREATE TYPE public.promo_grant_lifetime_mode AS ENUM ('lifetime','days_after_redeem','fixed_business_date');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='promo_grant_status') THEN
    CREATE TYPE public.promo_grant_status AS ENUM ('active','exhausted','expired','reversed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='promo_grant_source') THEN
    CREATE TYPE public.promo_grant_source AS ENUM (
      'verification_bonus','manual_am','cashback','campaign','code_redeem','reversal','expiry_writeoff'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.premier_promo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES public.casinos(id),
  name text NOT NULL,
  scope public.promo_campaign_scope NOT NULL,
  funding_source public.promo_funding_source NOT NULL,
  amount bigint NOT NULL,
  grant_lifetime_mode public.promo_grant_lifetime_mode NOT NULL DEFAULT 'lifetime',
  grant_lifetime_days int,
  grant_fixed_business_date date,
  active_from date,
  active_until date,
  total_cap bigint,
  used_amount bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.premier_promo_campaigns TO authenticated;
GRANT ALL ON public.premier_promo_campaigns TO service_role;
ALTER TABLE public.premier_promo_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM/admin manage campaigns" ON public.premier_promo_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));
CREATE POLICY "Authenticated read campaigns" ON public.premier_promo_campaigns FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  campaign_id uuid REFERENCES public.premier_promo_campaigns(id),
  amount bigint NOT NULL,
  code_active_from timestamptz,
  code_active_until timestamptz,
  grant_lifetime_mode public.promo_grant_lifetime_mode NOT NULL DEFAULT 'lifetime',
  grant_lifetime_days int,
  grant_fixed_business_date date,
  per_player_limit int NOT NULL DEFAULT 1,
  max_uses_total int,
  current_uses int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM/admin manage codes" ON public.promo_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.promo_codes(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  grant_id uuid,
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcr_code ON public.promo_code_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_pcr_player ON public.promo_code_redemptions(player_id);
GRANT SELECT, INSERT ON public.promo_code_redemptions TO authenticated;
GRANT ALL ON public.promo_code_redemptions TO service_role;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM/admin/cashier read code redemptions" ON public.promo_code_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Insert code redemptions" ON public.promo_code_redemptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier'));

-- ============================================================
-- PROMO GRANTS + WALLET LEDGER + REDEMPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  amount bigint NOT NULL,
  remaining bigint NOT NULL,
  source public.promo_grant_source NOT NULL,
  source_ref uuid,
  funding_pool public.promo_funding_source NOT NULL,
  funding_pool_ref uuid,
  issued_business_date date NOT NULL,
  expires_business_date date,
  status public.promo_grant_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grants_player_active ON public.promo_grants(player_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_grants_expiry ON public.promo_grants(expires_business_date) WHERE status = 'active' AND expires_business_date IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.promo_grants TO authenticated;
GRANT ALL ON public.promo_grants TO service_role;
ALTER TABLE public.promo_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read promo_grants" ON public.promo_grants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'));
CREATE POLICY "AM/admin/cashier insert grants" ON public.promo_grants FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'reception'));
CREATE POLICY "AM/admin update grants" ON public.promo_grants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier'));

CREATE TABLE IF NOT EXISTS public.promo_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.promo_grants(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id),
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  business_date date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pwl_player ON public.promo_wallet_ledger(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwl_grant ON public.promo_wallet_ledger(grant_id);
GRANT SELECT, INSERT ON public.promo_wallet_ledger TO authenticated;
GRANT ALL ON public.promo_wallet_ledger TO service_role;
ALTER TABLE public.promo_wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read wallet ledger" ON public.promo_wallet_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'));
CREATE POLICY "Insert wallet ledger" ON public.promo_wallet_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'reception'));

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  cage_id uuid,
  cashier_id uuid,
  shift_id uuid,
  amount bigint NOT NULL,
  grant_breakdown jsonb NOT NULL,
  payout_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pr_player ON public.promo_redemptions(player_id, created_at DESC);
GRANT SELECT, INSERT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read promo redemptions" ON public.promo_redemptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cashier creates redemptions" ON public.promo_redemptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.deny_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Ledger rows are immutable';
END $$;

DROP TRIGGER IF EXISTS deny_upd_house_ledger ON public.house_promo_ledger;
CREATE TRIGGER deny_upd_house_ledger BEFORE UPDATE OR DELETE ON public.house_promo_ledger
  FOR EACH ROW EXECUTE FUNCTION public.deny_ledger_mutation();

DROP TRIGGER IF EXISTS deny_upd_am_ledger ON public.am_budget_ledger;
CREATE TRIGGER deny_upd_am_ledger BEFORE UPDATE OR DELETE ON public.am_budget_ledger
  FOR EACH ROW EXECUTE FUNCTION public.deny_ledger_mutation();

DROP TRIGGER IF EXISTS deny_upd_wallet_ledger ON public.promo_wallet_ledger;
CREATE TRIGGER deny_upd_wallet_ledger BEFORE UPDATE OR DELETE ON public.promo_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.deny_ledger_mutation();

-- Profile lock: verified players are AM-only for core PII
CREATE OR REPLACE FUNCTION public.enforce_player_profile_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.verification_status = 'verified'
     AND NOT (public.has_role(auth.uid(),'account_manager') OR public.has_role(auth.uid(),'super_admin'))
  THEN
    IF NEW.first_name <> OLD.first_name
       OR NEW.last_name <> OLD.last_name
       OR NEW.phone <> OLD.phone
       OR NEW.id_number <> OLD.id_number
       OR COALESCE(NEW.birth_date::text,'') <> COALESCE(OLD.birth_date::text,'')
    THEN
      RAISE EXCEPTION 'Verified player profile can only be edited by Account Manager';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_player_profile_lock ON public.players;
CREATE TRIGGER trg_player_profile_lock BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_player_profile_lock();

-- Funding pool debit on grant insert
CREATE OR REPLACE FUNCTION public.debit_funding_pool_on_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance bigint;
BEGIN
  IF NEW.source IN ('reversal','expiry_writeoff') THEN
    RETURN NEW;
  END IF;

  IF NEW.funding_pool = 'house' THEN
    SELECT balance INTO v_balance FROM public.house_promo_fund WHERE casino_id = NEW.casino_id FOR UPDATE;
    IF v_balance IS NULL THEN
      INSERT INTO public.house_promo_fund(casino_id, balance) VALUES (NEW.casino_id, 0);
      v_balance := 0;
    END IF;
    IF v_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient house promo fund (have %, need %)', v_balance, NEW.amount;
    END IF;
    UPDATE public.house_promo_fund SET balance = balance - NEW.amount, updated_at = now() WHERE casino_id = NEW.casino_id;
    INSERT INTO public.house_promo_ledger(casino_id, delta, reason, ref_type, ref_id, created_by)
      VALUES (NEW.casino_id, -NEW.amount, 'grant_issued:'||NEW.source::text, 'promo_grant', NEW.id, NEW.created_by);

  ELSIF NEW.funding_pool = 'am_budget' THEN
    IF NEW.funding_pool_ref IS NULL THEN
      RAISE EXCEPTION 'AM budget grant requires funding_pool_ref (am_user_id)';
    END IF;
    SELECT balance INTO v_balance FROM public.am_budgets
      WHERE am_user_id = NEW.funding_pool_ref AND casino_id = NEW.casino_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient AM budget (have %, need %)', COALESCE(v_balance,0), NEW.amount;
    END IF;
    UPDATE public.am_budgets SET balance = balance - NEW.amount, updated_at = now()
      WHERE am_user_id = NEW.funding_pool_ref AND casino_id = NEW.casino_id;
    INSERT INTO public.am_budget_ledger(am_user_id, casino_id, delta, reason, ref_type, ref_id, created_by)
      VALUES (NEW.funding_pool_ref, NEW.casino_id, -NEW.amount, 'grant_issued:'||NEW.source::text, 'promo_grant', NEW.id, NEW.created_by);

  ELSIF NEW.funding_pool = 'campaign_budget' THEN
    IF NEW.funding_pool_ref IS NULL THEN
      RAISE EXCEPTION 'Campaign grant requires funding_pool_ref (campaign_id)';
    END IF;
    UPDATE public.premier_promo_campaigns
      SET used_amount = used_amount + NEW.amount, updated_at = now()
      WHERE id = NEW.funding_pool_ref
        AND (total_cap IS NULL OR used_amount + NEW.amount <= total_cap);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Campaign cap exceeded or not found';
    END IF;
  END IF;

  INSERT INTO public.promo_wallet_ledger(grant_id, player_id, delta, reason, ref_type, ref_id, business_date, created_by)
    VALUES (NEW.id, NEW.player_id, NEW.amount, 'grant_issued:'||NEW.source::text, 'promo_grant', NEW.id, NEW.issued_business_date, NEW.created_by);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_debit_funding_pool ON public.promo_grants;
CREATE TRIGGER trg_debit_funding_pool AFTER INSERT ON public.promo_grants
  FOR EACH ROW EXECUTE FUNCTION public.debit_funding_pool_on_grant();

-- Helper RPCs
CREATE OR REPLACE FUNCTION public.get_promo_wallet_balance(p_player_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(remaining),0)::bigint FROM public.promo_grants
  WHERE player_id = p_player_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_promo_chip(p_chip_color_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_promo,false) FROM public.chip_color_settings WHERE id = p_chip_color_id;
$$;
