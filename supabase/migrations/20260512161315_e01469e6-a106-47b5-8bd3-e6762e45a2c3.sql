
-- ============================================================================
-- PAYROLL MODULE
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EMPLOYEES MASTER
-- ---------------------------------------------------------------------------
CREATE TABLE public.employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id       UUID NOT NULL REFERENCES public.casinos(id) ON DELETE RESTRICT,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  position        TEXT NOT NULL DEFAULT '',
  department      TEXT NOT NULL DEFAULT '',
  employment_date DATE,
  photo_url       TEXT,
  nssf_number     TEXT,
  tax_id          TEXT,
  gepf_number     TEXT,
  basic_salary    BIGINT NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  payroll_status  TEXT NOT NULL DEFAULT 'active' CHECK (payroll_status IN ('active','inactive')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_casino   ON public.employees(casino_id);
CREATE INDEX idx_employees_status   ON public.employees(casino_id, payroll_status);

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_payroll_roles" ON public.employees FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );

CREATE POLICY "employees_write_hr" ON public.employees FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2. BANK ACCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  bank_name      TEXT NOT NULL DEFAULT '',
  bank_code      TEXT NOT NULL DEFAULT '',
  branch_code    TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  is_primary     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_accounts_employee ON public.employee_bank_accounts(employee_id);
CREATE UNIQUE INDEX uq_bank_accounts_primary ON public.employee_bank_accounts(employee_id) WHERE is_primary;

ALTER TABLE public.employee_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select" ON public.employee_bank_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_id
              AND (public.has_role(auth.uid(), 'super_admin'::app_role)
                   OR public.has_role(auth.uid(), 'finance_manager'::app_role)
                   OR (public.has_role(auth.uid(), 'hr'::app_role)
                       AND e.casino_id = public.get_user_casino_id(auth.uid()))))
  );

CREATE POLICY "bank_accounts_write_hr" ON public.employee_bank_accounts FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_id
              AND (public.has_role(auth.uid(), 'super_admin'::app_role)
                   OR (public.has_role(auth.uid(), 'hr'::app_role)
                       AND e.casino_id = public.get_user_casino_id(auth.uid()))))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_id
              AND (public.has_role(auth.uid(), 'super_admin'::app_role)
                   OR (public.has_role(auth.uid(), 'hr'::app_role)
                       AND e.casino_id = public.get_user_casino_id(auth.uid()))))
  );

-- ---------------------------------------------------------------------------
-- 3. TAX BRACKETS (TRA monthly PAYE, progressive)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tax_brackets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from  DATE NOT NULL,
  bracket_order   INT  NOT NULL,
  lower_bound     BIGINT NOT NULL,            -- inclusive
  upper_bound     BIGINT,                     -- exclusive; NULL = no upper limit
  base_tax        BIGINT NOT NULL DEFAULT 0,  -- cumulative tax up to lower_bound
  rate_pct        NUMERIC(5,2) NOT NULL,      -- e.g. 8.00, 20.00, 30.00
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (effective_from, bracket_order)
);
ALTER TABLE public.tax_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_brackets_select" ON public.tax_brackets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
  );
CREATE POLICY "tax_brackets_write_super" ON public.tax_brackets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- TRA monthly PAYE 2023 (effective indefinitely until super_admin updates)
INSERT INTO public.tax_brackets (effective_from, bracket_order, lower_bound, upper_bound, base_tax, rate_pct) VALUES
  ('2023-07-01', 1,        0,    270000,        0,  0.00),
  ('2023-07-01', 2,   270000,    520000,        0,  8.00),
  ('2023-07-01', 3,   520000,    760000,    20000, 20.00),
  ('2023-07-01', 4,   760000,   1000000,    68000, 25.00),
  ('2023-07-01', 5,  1000000,      NULL,   128000, 30.00);

-- ---------------------------------------------------------------------------
-- 4. PAYROLL SETTINGS (per casino, versioned by effective_from)
-- ---------------------------------------------------------------------------
CREATE TABLE public.payroll_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id           UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  effective_from      DATE NOT NULL,
  hours_per_month     INT  NOT NULL DEFAULT 195,
  night_hours_per_day INT  NOT NULL DEFAULT 10,
  night_rate_pct      NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  gepf_pct            NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  nssf_employee_pct   NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  nssf_employer_pct   NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  wcf_pct             NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  sdl_pct             NUMERIC(5,2) NOT NULL DEFAULT 3.50,
  working_days        INT  NOT NULL DEFAULT 26,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, effective_from)
);
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_settings_select" ON public.payroll_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );
CREATE POLICY "payroll_settings_write_super" ON public.payroll_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Seed defaults for every existing casino
INSERT INTO public.payroll_settings (casino_id, effective_from)
SELECT id, '2023-01-01'::date FROM public.casinos
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. PAYROLL PERIODS
-- ---------------------------------------------------------------------------
CREATE TABLE public.payroll_periods (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id            UUID NOT NULL REFERENCES public.casinos(id) ON DELETE RESTRICT,
  year                 INT  NOT NULL,
  month                INT  NOT NULL CHECK (month BETWEEN 1 AND 12),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','hr_approved','locked')),
  hr_approved_by       UUID REFERENCES auth.users(id),
  hr_approved_at       TIMESTAMPTZ,
  manager_approved_by  UUID REFERENCES auth.users(id),
  manager_approved_at  TIMESTAMPTZ,
  locked_at            TIMESTAMPTZ,
  unlocked_by          UUID REFERENCES auth.users(id),
  unlocked_at          TIMESTAMPTZ,
  unlock_reason        TEXT,
  created_by           UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, year, month)
);
CREATE INDEX idx_payroll_periods_casino ON public.payroll_periods(casino_id, year DESC, month DESC);

CREATE TRIGGER trg_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods_select" ON public.payroll_periods FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );

-- Direct INSERT/UPDATE blocked for non-super; flow via RPCs.
CREATE POLICY "periods_write_super" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------------------------------------------------------------------------
-- 6. PAYROLL ENTRIES
-- ---------------------------------------------------------------------------
CREATE TABLE public.payroll_entries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id                   UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id                 UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  casino_id                   UUID NOT NULL REFERENCES public.casinos(id) ON DELETE RESTRICT,
  -- snapshots (frozen at row creation; useful for the slip and bank export)
  snapshot_full_name          TEXT NOT NULL,
  snapshot_position           TEXT NOT NULL DEFAULT '',
  snapshot_basic_salary       BIGINT NOT NULL DEFAULT 0,
  snapshot_account_number     TEXT NOT NULL DEFAULT '',
  snapshot_bank_code          TEXT NOT NULL DEFAULT '',
  snapshot_branch_code        TEXT NOT NULL DEFAULT '',
  -- editable inputs
  public_holiday_worked       INT NOT NULL DEFAULT 0,
  hrs_worked_on_holiday       INT NOT NULL DEFAULT 0,
  night_days                  INT NOT NULL DEFAULT 0,
  off_days                    INT NOT NULL DEFAULT 0,
  off_days_hours              INT NOT NULL DEFAULT 0,
  cash_shortage               BIGINT NOT NULL DEFAULT 0,
  salary_advances             BIGINT NOT NULL DEFAULT 0,
  missing_days                INT NOT NULL DEFAULT 0,
  gepf_loan                   BIGINT NOT NULL DEFAULT 0,
  -- computed (filled by trigger)
  public_holiday_earned       BIGINT NOT NULL DEFAULT 0,
  night_allowance_hours       INT    NOT NULL DEFAULT 0,
  night_allowance             BIGINT NOT NULL DEFAULT 0,
  off_days_total              BIGINT NOT NULL DEFAULT 0,
  gross_salary                BIGINT NOT NULL DEFAULT 0,
  gepf_employee               BIGINT NOT NULL DEFAULT 0,
  nssf_employee               BIGINT NOT NULL DEFAULT 0,
  taxable_pay                 BIGINT NOT NULL DEFAULT 0,
  paye                        BIGINT NOT NULL DEFAULT 0,
  deductions_missing_days     BIGINT NOT NULL DEFAULT 0,
  net_salary                  BIGINT NOT NULL DEFAULT 0,
  -- employer side (for tax reports)
  nssf_employer               BIGINT NOT NULL DEFAULT 0,
  wcf_amount                  BIGINT NOT NULL DEFAULT 0,
  sdl_amount                  BIGINT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);
CREATE INDEX idx_entries_period   ON public.payroll_entries(period_id);
CREATE INDEX idx_entries_employee ON public.payroll_entries(employee_id);
CREATE INDEX idx_entries_casino   ON public.payroll_entries(casino_id);

CREATE TRIGGER trg_payroll_entries_updated_at BEFORE UPDATE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_select" ON public.payroll_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );

CREATE POLICY "entries_write_hr_draft" ON public.payroll_entries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid())
        AND EXISTS (SELECT 1 FROM public.payroll_periods p
                    WHERE p.id = period_id AND p.status = 'draft'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid())
        AND EXISTS (SELECT 1 FROM public.payroll_periods p
                    WHERE p.id = period_id AND p.status = 'draft'))
  );

-- ---------------------------------------------------------------------------
-- 7. AUDIT LOG (immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE public.payroll_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  casino_id   UUID NOT NULL,
  action      TEXT NOT NULL,
  actor_id    UUID REFERENCES auth.users(id),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_audit_period ON public.payroll_audit_log(period_id);
ALTER TABLE public.payroll_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON public.payroll_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
    OR (public.has_role(auth.uid(), 'hr'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.prevent_payroll_audit_modify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Payroll audit log is immutable';
END;
$$;
CREATE TRIGGER trg_payroll_audit_immutable
  BEFORE UPDATE OR DELETE ON public.payroll_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payroll_audit_modify();

-- ---------------------------------------------------------------------------
-- 8. CALCULATION TRIGGER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_paye_for_amount(_amount BIGINT, _at DATE)
RETURNS BIGINT LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_eff DATE;
  v_paye NUMERIC := 0;
  v_bracket RECORD;
BEGIN
  IF _amount <= 0 THEN RETURN 0; END IF;

  SELECT MAX(effective_from) INTO v_eff
  FROM public.tax_brackets
  WHERE effective_from <= _at;

  IF v_eff IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_bracket
  FROM public.tax_brackets
  WHERE effective_from = v_eff
    AND lower_bound <= _amount
    AND (upper_bound IS NULL OR _amount < upper_bound)
  ORDER BY bracket_order DESC
  LIMIT 1;

  IF v_bracket IS NULL THEN RETURN 0; END IF;

  v_paye := v_bracket.base_tax + (_amount - v_bracket.lower_bound) * (v_bracket.rate_pct / 100.0);
  RETURN ROUND(v_paye)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_payroll_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_settings public.payroll_settings%ROWTYPE;
  v_period   public.payroll_periods%ROWTYPE;
  v_period_date DATE;
  v_basic NUMERIC;
  v_hourly NUMERIC;
  v_holiday NUMERIC;
  v_night_hours INT;
  v_night NUMERIC;
  v_off NUMERIC;
  v_gross NUMERIC;
  v_gepf NUMERIC;
  v_nssf_e NUMERIC;
  v_taxable NUMERIC;
  v_paye BIGINT;
  v_miss NUMERIC;
  v_net NUMERIC;
BEGIN
  SELECT * INTO v_period FROM public.payroll_periods WHERE id = NEW.period_id;
  v_period_date := make_date(v_period.year, v_period.month, 1);

  SELECT * INTO v_settings
  FROM public.payroll_settings
  WHERE casino_id = NEW.casino_id AND effective_from <= v_period_date
  ORDER BY effective_from DESC LIMIT 1;

  IF v_settings.id IS NULL THEN
    -- fallback defaults
    v_settings.hours_per_month := 195;
    v_settings.night_hours_per_day := 10;
    v_settings.night_rate_pct := 5.00;
    v_settings.gepf_pct := 10.00;
    v_settings.nssf_employee_pct := 10.00;
    v_settings.nssf_employer_pct := 10.00;
    v_settings.wcf_pct := 1.00;
    v_settings.sdl_pct := 3.50;
    v_settings.working_days := 26;
  END IF;

  v_basic  := COALESCE(NEW.snapshot_basic_salary, 0);
  v_hourly := CASE WHEN v_settings.hours_per_month > 0
                   THEN v_basic / v_settings.hours_per_month
                   ELSE 0 END;

  v_holiday := v_hourly * COALESCE(NEW.public_holiday_worked,0) * COALESCE(NEW.hrs_worked_on_holiday,0);

  v_night_hours := v_settings.night_hours_per_day * COALESCE(NEW.night_days,0);
  v_night := v_hourly * (v_settings.night_rate_pct / 100.0) * v_night_hours;

  v_off := v_hourly * COALESCE(NEW.off_days_hours,0);

  v_gross := v_basic + v_holiday + v_night + v_off;

  v_gepf  := v_gross * (v_settings.gepf_pct / 100.0);
  v_nssf_e:= v_gross * (v_settings.nssf_employee_pct / 100.0);
  v_taxable := v_gross - v_gepf - v_nssf_e;

  v_paye := public.compute_paye_for_amount(ROUND(v_taxable)::BIGINT, v_period_date);

  v_miss := CASE WHEN v_settings.working_days > 0
                 THEN v_basic / v_settings.working_days * COALESCE(NEW.missing_days,0)
                 ELSE 0 END;

  v_net := v_gross - v_gepf - v_nssf_e - v_paye
           - COALESCE(NEW.cash_shortage,0)
           - COALESCE(NEW.salary_advances,0)
           - v_miss
           - COALESCE(NEW.gepf_loan,0);

  NEW.public_holiday_earned   := ROUND(v_holiday)::BIGINT;
  NEW.night_allowance_hours   := v_night_hours;
  NEW.night_allowance         := ROUND(v_night)::BIGINT;
  NEW.off_days_total          := ROUND(v_off)::BIGINT;
  NEW.gross_salary            := ROUND(v_gross)::BIGINT;
  NEW.gepf_employee           := ROUND(v_gepf)::BIGINT;
  NEW.nssf_employee           := ROUND(v_nssf_e)::BIGINT;
  NEW.taxable_pay             := ROUND(v_taxable)::BIGINT;
  NEW.paye                    := v_paye;
  NEW.deductions_missing_days := ROUND(v_miss)::BIGINT;
  NEW.net_salary              := ROUND(v_net)::BIGINT;

  NEW.nssf_employer := ROUND(v_gross * v_settings.nssf_employer_pct / 100.0)::BIGINT;
  NEW.wcf_amount    := ROUND(v_gross * v_settings.wcf_pct / 100.0)::BIGINT;
  NEW.sdl_amount    := ROUND(v_gross * v_settings.sdl_pct / 100.0)::BIGINT;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_payroll_entry
  BEFORE INSERT OR UPDATE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.compute_payroll_entry();

-- ---------------------------------------------------------------------------
-- 9. LOCK GUARD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_locked_payroll_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.payroll_periods
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);

  IF v_status = 'locked' THEN
    RAISE EXCEPTION 'Payroll period is locked and cannot be modified';
  END IF;

  IF v_status = 'hr_approved' AND TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    -- only finance/super may touch hr_approved (HR cannot)
    IF NOT (public.has_role(auth.uid(),'super_admin'::app_role)
            OR public.has_role(auth.uid(),'finance_manager'::app_role)) THEN
      RAISE EXCEPTION 'Period is HR-approved; only Finance Manager may modify';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_prevent_locked_payroll_entry
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_payroll_entry();

-- ---------------------------------------------------------------------------
-- 10. RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_create_period(_year INT, _month INT, _casino_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_casino UUID; v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF NOT (public.has_role(auth.uid(),'hr'::app_role)
          OR public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'HR, Finance Manager or Super Admin role required';
  END IF;

  v_casino := COALESCE(_casino_id, public.get_user_casino_id(auth.uid()));
  IF v_casino IS NULL THEN RAISE EXCEPTION 'Casino not specified'; END IF;

  -- non-super must use their own casino
  IF NOT public.has_role(auth.uid(),'super_admin'::app_role)
     AND NOT public.has_role(auth.uid(),'finance_manager'::app_role)
     AND v_casino <> public.get_user_casino_id(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot create period for another casino';
  END IF;

  INSERT INTO public.payroll_periods (casino_id, year, month, created_by)
  VALUES (v_casino, _year, _month, auth.uid())
  RETURNING id INTO v_id;

  -- seed entries from active employees
  INSERT INTO public.payroll_entries (
    period_id, employee_id, casino_id,
    snapshot_full_name, snapshot_position, snapshot_basic_salary,
    snapshot_account_number, snapshot_bank_code, snapshot_branch_code
  )
  SELECT v_id, e.id, e.casino_id,
         e.full_name, e.position, e.basic_salary,
         COALESCE(b.account_number,''), COALESCE(b.bank_code,''), COALESCE(b.branch_code,'')
  FROM public.employees e
  LEFT JOIN public.employee_bank_accounts b ON b.employee_id = e.id AND b.is_primary
  WHERE e.casino_id = v_casino AND e.payroll_status = 'active';

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id, details)
  VALUES (v_id, v_casino, 'create_period', auth.uid(),
          jsonb_build_object('year',_year,'month',_month));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_duplicate_period(_source_period_id UUID, _year INT, _month INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src public.payroll_periods%ROWTYPE; v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(auth.uid(),'hr'::app_role)
          OR public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'HR, Finance Manager or Super Admin role required';
  END IF;

  SELECT * INTO v_src FROM public.payroll_periods WHERE id = _source_period_id;
  IF v_src.id IS NULL THEN RAISE EXCEPTION 'Source period not found'; END IF;

  INSERT INTO public.payroll_periods (casino_id, year, month, created_by)
  VALUES (v_src.casino_id, _year, _month, auth.uid())
  RETURNING id INTO v_id;

  -- clone entries snapshots, zero out hours & deductions
  INSERT INTO public.payroll_entries (
    period_id, employee_id, casino_id,
    snapshot_full_name, snapshot_position, snapshot_basic_salary,
    snapshot_account_number, snapshot_bank_code, snapshot_branch_code
  )
  SELECT v_id, e.employee_id, e.casino_id,
         e.snapshot_full_name, e.snapshot_position, e.snapshot_basic_salary,
         e.snapshot_account_number, e.snapshot_bank_code, e.snapshot_branch_code
  FROM public.payroll_entries e
  WHERE e.period_id = _source_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id, details)
  VALUES (v_id, v_src.casino_id, 'duplicate_period', auth.uid(),
          jsonb_build_object('source', _source_period_id, 'year',_year,'month',_month));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_approve_hr(_period_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payroll_periods%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'hr'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'HR or Super Admin role required';
  END IF;
  SELECT * INTO v_p FROM public.payroll_periods WHERE id = _period_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_p.status <> 'draft' THEN RAISE EXCEPTION 'Period not in draft state'; END IF;

  UPDATE public.payroll_periods
     SET status='hr_approved',
         hr_approved_by=auth.uid(),
         hr_approved_at=now()
   WHERE id=_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id)
  VALUES (_period_id, v_p.casino_id, 'hr_approve', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_revert_to_draft(_period_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payroll_periods%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Finance Manager or Super Admin role required';
  END IF;
  SELECT * INTO v_p FROM public.payroll_periods WHERE id = _period_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_p.status <> 'hr_approved' THEN RAISE EXCEPTION 'Period not in hr_approved state'; END IF;

  UPDATE public.payroll_periods
     SET status='draft', hr_approved_by=NULL, hr_approved_at=NULL
   WHERE id=_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id, details)
  VALUES (_period_id, v_p.casino_id, 'revert_to_draft', auth.uid(),
          jsonb_build_object('reason',_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_approve_manager(_period_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payroll_periods%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Finance Manager or Super Admin role required';
  END IF;
  SELECT * INTO v_p FROM public.payroll_periods WHERE id = _period_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_p.status <> 'hr_approved' THEN RAISE EXCEPTION 'Period not HR-approved'; END IF;

  UPDATE public.payroll_periods
     SET status='locked',
         manager_approved_by=auth.uid(),
         manager_approved_at=now(),
         locked_at=now()
   WHERE id=_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id)
  VALUES (_period_id, v_p.casino_id, 'manager_approve_lock', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_unlock_period(_period_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payroll_periods%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Super Admin role required';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Unlock reason is required';
  END IF;

  SELECT * INTO v_p FROM public.payroll_periods WHERE id = _period_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_p.status <> 'locked' THEN RAISE EXCEPTION 'Period is not locked'; END IF;

  UPDATE public.payroll_periods
     SET status='hr_approved',
         locked_at=NULL,
         unlocked_by=auth.uid(),
         unlocked_at=now(),
         unlock_reason=_reason,
         manager_approved_by=NULL,
         manager_approved_at=NULL
   WHERE id=_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id, details)
  VALUES (_period_id, v_p.casino_id, 'unlock', auth.uid(),
          jsonb_build_object('reason',_reason));
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. STORAGE BUCKET (employee photos)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "employee_photos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (
      public.has_role(auth.uid(),'super_admin'::app_role)
      OR public.has_role(auth.uid(),'finance_manager'::app_role)
      OR public.has_role(auth.uid(),'hr'::app_role)
      OR public.has_role(auth.uid(),'manager'::app_role)
      OR public.has_role(auth.uid(),'surveillance'::app_role)
    )
  );

CREATE POLICY "employee_photos_write_hr"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND (public.has_role(auth.uid(),'hr'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "employee_photos_update_hr"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (public.has_role(auth.uid(),'hr'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "employee_photos_delete_hr"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (public.has_role(auth.uid(),'hr'::app_role)
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  );

-- ---------------------------------------------------------------------------
-- 12. MODULE CATALOG SEED
-- ---------------------------------------------------------------------------
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write, day_horizon)
VALUES
  ('hr',              'staff_master', true,  true,  'all'),
  ('hr',              'payroll',      true,  true,  'all'),
  ('finance_manager', 'staff_master', true,  false, 'all'),
  ('finance_manager', 'payroll',      true,  true,  'all')
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view=EXCLUDED.can_view, can_write=EXCLUDED.can_write, day_horizon=EXCLUDED.day_horizon;
