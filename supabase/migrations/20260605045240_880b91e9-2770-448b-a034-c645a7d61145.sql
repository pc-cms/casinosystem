
-- ============================================================
-- FINANCES FULL REWRITE: M1 (drop) + M2 (new schema) + M3 (seed)
-- ============================================================

DROP TABLE IF EXISTS public.budget_logs CASCADE;
DROP TABLE IF EXISTS public.budget_items CASCADE;
DROP TABLE IF EXISTS public.budget_periods CASCADE;
DROP TABLE IF EXISTS public.budget_categories CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.financial_wallets CASCADE;
DROP TABLE IF EXISTS public.daily_summaries CASCADE;
DROP TABLE IF EXISTS public.inter_casino_transfers CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP FUNCTION IF EXISTS public.touch_expense_categories() CASCADE;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fin_category_id uuid,
  ADD COLUMN IF NOT EXISTS wallet_id uuid,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TZS',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_tzs numeric(18,2),
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS is_overrun boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overrun_reason text,
  ADD COLUMN IF NOT EXISTS overrun_approved_by uuid,
  ADD COLUMN IF NOT EXISTS reversal_of uuid,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

CREATE TABLE public.fin_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code text NOT NULL,
  group_name text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_income boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_code, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_categories TO authenticated;
GRANT ALL ON public.fin_categories TO service_role;
ALTER TABLE public.fin_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_read ON public.fin_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY fc_write ON public.fin_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash','bank','safe','cage','external')),
  currency text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_wallets TO authenticated;
GRANT ALL ON public.fin_wallets TO service_role;
ALTER TABLE public.fin_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY fw_read ON public.fin_wallets FOR SELECT TO authenticated USING (true);
CREATE POLICY fw_write ON public.fin_wallets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_wallet_tx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.fin_wallets(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('income','expense','change_in','change_out','transfer_in','transfer_out','reversal','adjustment')),
  category_id uuid REFERENCES public.fin_categories(id),
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  fx_rate numeric(18,6) NOT NULL DEFAULT 1,
  amount_tzs numeric(18,2) NOT NULL,
  ref_table text,
  ref_id uuid,
  reversal_of uuid REFERENCES public.fin_wallet_tx(id),
  business_date date NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fwtx_casino_bd ON public.fin_wallet_tx(casino_id, business_date);
CREATE INDEX fwtx_wallet ON public.fin_wallet_tx(wallet_id);
CREATE INDEX fwtx_cat ON public.fin_wallet_tx(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_wallet_tx TO authenticated;
GRANT ALL ON public.fin_wallet_tx TO service_role;
ALTER TABLE public.fin_wallet_tx ENABLE ROW LEVEL SECURITY;
CREATE POLICY fwtx_read ON public.fin_wallet_tx FOR SELECT TO authenticated USING (true);
CREATE POLICY fwtx_write ON public.fin_wallet_tx FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_day_closing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  tables_result numeric(18,2) NOT NULL DEFAULT 0,
  slots_result numeric(18,2) NOT NULL DEFAULT 0,
  income_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  closed_by uuid,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, business_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_day_closing TO authenticated;
GRANT ALL ON public.fin_day_closing TO service_role;
ALTER TABLE public.fin_day_closing ENABLE ROW LEVEL SECURITY;
CREATE POLICY fdc_read ON public.fin_day_closing FOR SELECT TO authenticated USING (true);
CREATE POLICY fdc_write ON public.fin_day_closing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_money_change (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  to_casino_id uuid REFERENCES public.casinos(id),
  from_wallet_id uuid NOT NULL REFERENCES public.fin_wallets(id),
  to_wallet_id uuid NOT NULL REFERENCES public.fin_wallets(id),
  from_amount numeric(18,2) NOT NULL,
  from_currency text NOT NULL,
  to_amount numeric(18,2) NOT NULL,
  to_currency text NOT NULL,
  rate numeric(18,6) NOT NULL,
  business_date date NOT NULL,
  note text,
  manager_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_money_change TO authenticated;
GRANT ALL ON public.fin_money_change TO service_role;
ALTER TABLE public.fin_money_change ENABLE ROW LEVEL SECURITY;
CREATE POLICY fmc_read ON public.fin_money_change FOR SELECT TO authenticated USING (true);
CREATE POLICY fmc_write ON public.fin_money_change FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 0 AND 12),
  category_id uuid NOT NULL REFERENCES public.fin_categories(id),
  currency text NOT NULL CHECK (currency IN ('TZS','USD')),
  planned_amount numeric(18,2) NOT NULL DEFAULT 0,
  overrun_limit_pct numeric(6,2) NOT NULL DEFAULT 110,
  approved_by uuid,
  approved_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, year, month, category_id, currency)
);
CREATE INDEX fb_casino_period ON public.fin_budget(casino_id, year, month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_budget TO authenticated;
GRANT ALL ON public.fin_budget TO service_role;
ALTER TABLE public.fin_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY fb_read ON public.fin_budget FOR SELECT TO authenticated USING (true);
CREATE POLICY fb_write ON public.fin_budget FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.fin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid,
  actor uuid,
  action text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fal_created ON public.fin_audit_log(created_at);
CREATE INDEX fal_entity ON public.fin_audit_log(entity_table, entity_id);
GRANT SELECT, INSERT ON public.fin_audit_log TO authenticated;
GRANT ALL ON public.fin_audit_log TO service_role;
ALTER TABLE public.fin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY fal_read ON public.fin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));
CREATE POLICY fal_ins ON public.fin_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.fin_excel_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  filename text NOT NULL,
  raw_data jsonb NOT NULL,
  mapping jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','mapped','applied','failed')),
  target_kind text NOT NULL CHECK (target_kind IN ('budget','expenses')),
  rows_imported int DEFAULT 0,
  error_log text,
  imported_by uuid NOT NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_excel_imports TO authenticated;
GRANT ALL ON public.fin_excel_imports TO service_role;
ALTER TABLE public.fin_excel_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY fei_rw ON public.fin_excel_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_manager'));

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_fin_category_fk FOREIGN KEY (fin_category_id) REFERENCES public.fin_categories(id);
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_wallet_fk FOREIGN KEY (wallet_id) REFERENCES public.fin_wallets(id);

CREATE OR REPLACE FUNCTION public.fin_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_fc_upd BEFORE UPDATE ON public.fin_categories FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER trg_fw_upd BEFORE UPDATE ON public.fin_wallets FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER trg_fdc_upd BEFORE UPDATE ON public.fin_day_closing FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER trg_fb_upd BEFORE UPDATE ON public.fin_budget FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

CREATE OR REPLACE FUNCTION public.fin_reverse_tx(p_tx_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orig public.fin_wallet_tx; v_new_id uuid;
BEGIN
  SELECT * INTO v_orig FROM public.fin_wallet_tx WHERE id = p_tx_id;
  IF v_orig IS NULL THEN RAISE EXCEPTION 'tx not found'; END IF;
  INSERT INTO public.fin_wallet_tx(casino_id, wallet_id, kind, category_id, amount, currency, fx_rate, amount_tzs, ref_table, ref_id, reversal_of, business_date, note, created_by)
  VALUES (v_orig.casino_id, v_orig.wallet_id, 'reversal', v_orig.category_id, -v_orig.amount, v_orig.currency, v_orig.fx_rate, -v_orig.amount_tzs, v_orig.ref_table, v_orig.ref_id, v_orig.id, v_orig.business_date, COALESCE(p_reason,'reversal'), auth.uid())
  RETURNING id INTO v_new_id;
  INSERT INTO public.fin_audit_log(casino_id, actor, action, entity_table, entity_id, before, after)
  VALUES (v_orig.casino_id, auth.uid(), 'reverse', 'fin_wallet_tx', v_orig.id, to_jsonb(v_orig), jsonb_build_object('reversal_id', v_new_id, 'reason', p_reason));
  RETURN v_new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fin_reverse_tx(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fin_budget_set_annual(p_casino uuid, p_year int, p_category uuid, p_currency text, p_annual numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_total numeric; v_delta numeric; v_remaining_months int; v_per_month numeric; v_start_month int;
BEGIN
  v_start_month := CASE WHEN p_year = EXTRACT(year FROM now())::int THEN EXTRACT(month FROM now())::int ELSE 1 END;
  v_remaining_months := 12 - v_start_month + 1;
  SELECT COALESCE(SUM(planned_amount),0) INTO v_current_total FROM public.fin_budget
    WHERE casino_id=p_casino AND year=p_year AND month BETWEEN 1 AND 12 AND category_id=p_category AND currency=p_currency;
  v_delta := p_annual - v_current_total;
  v_per_month := v_delta / v_remaining_months;
  FOR i IN v_start_month..12 LOOP
    INSERT INTO public.fin_budget(casino_id, year, month, category_id, currency, planned_amount)
    VALUES (p_casino, p_year, i, p_category, p_currency, v_per_month)
    ON CONFLICT (casino_id, year, month, category_id, currency)
    DO UPDATE SET planned_amount = public.fin_budget.planned_amount + EXCLUDED.planned_amount, updated_at = now();
  END LOOP;
  INSERT INTO public.fin_audit_log(casino_id, actor, action, entity_table, before, after)
  VALUES (p_casino, auth.uid(), 'annual_override', 'fin_budget', jsonb_build_object('old_total', v_current_total), jsonb_build_object('new_annual', p_annual, 'delta', v_delta));
END $$;
GRANT EXECUTE ON FUNCTION public.fin_budget_set_annual(uuid,int,uuid,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.fin_lock_day_closing(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.fin_day_closing; line jsonb;
BEGIN
  SELECT * INTO v FROM public.fin_day_closing WHERE id = p_id;
  IF v.locked_at IS NOT NULL THEN RAISE EXCEPTION 'already locked'; END IF;
  FOR line IN SELECT * FROM jsonb_array_elements(v.income_lines) LOOP
    INSERT INTO public.fin_wallet_tx(casino_id, wallet_id, kind, amount, currency, fx_rate, amount_tzs, ref_table, ref_id, business_date, created_by, note)
    VALUES (v.casino_id, (line->>'wallet_id')::uuid, 'income',
            (line->>'amount')::numeric, line->>'currency',
            COALESCE((line->>'fx_rate')::numeric, 1),
            (line->>'amount')::numeric * COALESCE((line->>'fx_rate')::numeric, 1),
            'fin_day_closing', v.id, v.business_date, auth.uid(), 'Day closing income');
  END LOOP;
  UPDATE public.fin_day_closing SET locked_at = now(), closed_by = auth.uid() WHERE id = p_id;
  INSERT INTO public.fin_audit_log(casino_id, actor, action, entity_table, entity_id, after)
  VALUES (v.casino_id, auth.uid(), 'lock', 'fin_day_closing', v.id, to_jsonb(v));
END $$;
GRANT EXECUTE ON FUNCTION public.fin_lock_day_closing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fin_money_change_create(
  p_casino uuid, p_to_casino uuid, p_from_wallet uuid, p_to_wallet uuid,
  p_from_amount numeric, p_from_ccy text, p_to_amount numeric, p_to_ccy text,
  p_rate numeric, p_business_date date, p_note text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.fin_money_change(casino_id,to_casino_id,from_wallet_id,to_wallet_id,from_amount,from_currency,to_amount,to_currency,rate,business_date,note,manager_id)
  VALUES (p_casino,p_to_casino,p_from_wallet,p_to_wallet,p_from_amount,p_from_ccy,p_to_amount,p_to_ccy,p_rate,p_business_date,p_note,auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.fin_wallet_tx(casino_id, wallet_id, kind, amount, currency, fx_rate, amount_tzs, ref_table, ref_id, business_date, created_by, note)
  VALUES (p_casino, p_from_wallet, 'change_out', -p_from_amount, p_from_ccy, 1, -p_from_amount, 'fin_money_change', v_id, p_business_date, auth.uid(), p_note);
  INSERT INTO public.fin_wallet_tx(casino_id, wallet_id, kind, amount, currency, fx_rate, amount_tzs, ref_table, ref_id, business_date, created_by, note)
  VALUES (COALESCE(p_to_casino,p_casino), p_to_wallet, 'change_in', p_to_amount, p_to_ccy, p_rate, p_to_amount*p_rate, 'fin_money_change', v_id, p_business_date, auth.uid(), p_note);
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fin_money_change_create(uuid,uuid,uuid,uuid,numeric,text,numeric,text,numeric,date,text) TO authenticated;

DO $cronblk$ BEGIN
  PERFORM cron.schedule('purge_fin_audit_log_daily','15 3 * * *', $cron$ DELETE FROM public.fin_audit_log WHERE created_at < now() - interval '365 days' $cron$);
EXCEPTION WHEN OTHERS THEN NULL; END $cronblk$;

INSERT INTO public.fin_categories (group_code, group_name, name, sort_order, is_income) VALUES
('fixed','Fixed Costs & Government Licences','EGT & Novomatic (incl 18% VAT)',10,false),
('fixed','Fixed Costs & Government Licences','Casino & House DSTV',20,false),
('fixed','Fixed Costs & Government Licences','Casino Parking Annual Fee',30,false),
('fixed','Fixed Costs & Government Licences','Casino Parking Annual Fee 2',31,false),
('fixed','Fixed Costs & Government Licences','Front Advertisement',40,false),
('fixed','Fixed Costs & Government Licences','GB Gaming Licence & Application',50,false),
('fixed','Fixed Costs & Government Licences','Licence for Fire',60,false),
('fixed','Fixed Costs & Government Licences','Hall Rent',70,false),
('fixed','Fixed Costs & Government Licences','Hall Rent & Debts',71,false),
('fixed','Fixed Costs & Government Licences','Hall Rent & Storage',72,false),
('fixed','Fixed Costs & Government Licences','House Rent',80,false),
('fixed','Fixed Costs & Government Licences','Internet Casino',90,false),
('fixed','Fixed Costs & Government Licences','Internet Casino & Home',91,false),
('fixed','Fixed Costs & Government Licences','Internet Smile & Phones',92,false),
('fixed','Fixed Costs & Government Licences','OSHA',100,false),
('fixed','Fixed Costs & Government Licences','COSOTA',110,false),
('fixed','Fixed Costs & Government Licences','Annual Audit Report & Lawyer',120,false),
('fixed','Fixed Costs & Government Licences','KK Security (Casino & House)',130,false),
('fixed','Fixed Costs & Government Licences','Service Levy (0.3% from Casino Profit)',140,false),
('fixed','Fixed Costs & Government Licences','Service Car',150,false),
('tax','Monthly Variable Government Taxes','Gaming Board Tax (18% from Incomes)',10,false),
('tax','Monthly Variable Government Taxes','SDL Tax (4.5% from Gross)',20,false),
('tax','Monthly Variable Government Taxes','PAYE Tax',30,false),
('tax','Monthly Variable Government Taxes','GEPF Tax (Pension Fund 20%)',40,false),
('tax','Monthly Variable Government Taxes','NSSF Tax (Pension Fund 20%)',50,false),
('tax','Monthly Variable Government Taxes','WCF Tax (0.5% from Gross Salary)',60,false),
('variable','Other Variable Expenses','Advertisement',10,false),
('variable','Other Variable Expenses','Bar',20,false),
('variable','Other Variable Expenses','Electricity',30,false),
('variable','Other Variable Expenses','Food for Customers & Staff',40,false),
('variable','Other Variable Expenses','Hall & House Reparation',50,false),
('variable','Other Variable Expenses','Reparation Machines and Tables',60,false),
('variable','Other Variable Expenses','Sanitary',70,false),
('variable','Other Variable Expenses','Stationary',80,false),
('variable','Other Variable Expenses','Konvertions',90,false),
('variable','Other Variable Expenses','Missing Money — Cashiers',100,false),
('variable','Other Variable Expenses','Other Variable Expenses',110,false),
('variable','Other Variable Expenses','Water',120,false),
('variable','Other Variable Expenses','Transport for Staff',130,false),
('salary','Salary Expenses','Staff Salary PAYROLL',10,false),
('salary','Salary Expenses','Cash in Hands & Bonuses',20,false),
('salary','Salary Expenses','Expats Salary',30,false),
('salary','Salary Expenses','CCTV Salary & Accountant',40,false),
('salary','Salary Expenses','Terminal Benefits',50,false),
('petrol','Petrol Expenses','Petrol for Driver',10,false),
('petrol','Petrol Expenses','Petrol for Cars',20,false),
('petrol','Petrol Expenses','Petrol for Cars (Toyota)',30,false),
('petrol','Petrol Expenses','Petrol for Cars (Toyota) & Generator',40,false),
('additional','Additional Expenses','Work Permits and Tickets',10,false),
('additional','Additional Expenses','Service for AC',20,false),
('additional','Additional Expenses','Service for AC (UPS)',30,false),
('additional','Additional Expenses','Lottery Expenses SLOTS & LIVE GAME',40,false),
('income','Income / Collection / CAPEX / Transfers','Tables Income',10,true),
('income','Income / Collection / CAPEX / Transfers','Slots Income',20,true),
('income','Income / Collection / CAPEX / Transfers','External Income',30,true),
('income','Income / Collection / CAPEX / Transfers','Owner Injection',40,true),
('income','Income / Collection / CAPEX / Transfers','Bank Loan',50,true),
('income','Income / Collection / CAPEX / Transfers','Collection (Owner Withdrawal)',60,false),
('income','Income / Collection / CAPEX / Transfers','CAPEX',70,false),
('income','Income / Collection / CAPEX / Transfers','Inter-Casino Transfer In',80,true),
('income','Income / Collection / CAPEX / Transfers','Inter-Casino Transfer Out',81,false),
('income','Income / Collection / CAPEX / Transfers','Money Change',90,false)
ON CONFLICT (group_code, name) DO NOTHING;
