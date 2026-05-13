
CREATE TABLE public.attendance_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Holiday',
  multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, date)
);
ALTER TABLE public.attendance_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View holidays in casino" ON public.attendance_holidays FOR SELECT
USING (casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role));

CREATE POLICY "HR/Manager edit holidays" ON public.attendance_holidays FOR ALL
USING (
  (casino_id = public.get_user_casino_id(auth.uid()) AND
    (public.has_role(auth.uid(),'hr'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)))
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role)
)
WITH CHECK (
  (casino_id = public.get_user_casino_id(auth.uid()) AND
    (public.has_role(auth.uid(),'hr'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)))
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role)
);

CREATE TABLE public.attendance_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(4,2) NOT NULL DEFAULT 0,
  note TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (casino_id, employee_id, date)
);
ALTER TABLE public.attendance_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attendance hours in casino" ON public.attendance_hours FOR SELECT
USING (casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role));

CREATE POLICY "HR/Manager edit attendance hours" ON public.attendance_hours FOR ALL
USING (
  (casino_id = public.get_user_casino_id(auth.uid()) AND
    (public.has_role(auth.uid(),'hr'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)))
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role)
)
WITH CHECK (
  (casino_id = public.get_user_casino_id(auth.uid()) AND
    (public.has_role(auth.uid(),'hr'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)))
  OR public.has_role(auth.uid(),'super_admin'::app_role)
  OR public.has_role(auth.uid(),'finance_manager'::app_role)
);

CREATE INDEX idx_attendance_hours_emp_date ON public.attendance_hours(casino_id, employee_id, date);
CREATE INDEX idx_attendance_holidays_casino_date ON public.attendance_holidays(casino_id, date);

CREATE TRIGGER trg_attendance_holidays_updated
BEFORE UPDATE ON public.attendance_holidays
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_attendance_hours_updated
BEFORE UPDATE ON public.attendance_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_monthly_attendance(p_casino_id UUID, p_month DATE)
RETURNS TABLE (
  employee_id UUID,
  full_name TEXT,
  department TEXT,
  job_position TEXT,
  is_pit_boss BOOLEAN,
  dealer_category TEXT,
  photo_url TEXT,
  d DATE,
  auto_hours NUMERIC,
  manual_hours NUMERIC,
  effective_hours NUMERIC,
  raw_value TEXT,
  is_holiday BOOLEAN,
  holiday_multiplier NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month)::DATE;
  v_end   DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(v_start, v_end, INTERVAL '1 day')::DATE AS dt
  ),
  emps AS (
    SELECT e.id AS emp_id, e.full_name, e.department, e.position AS pos,
           e.is_pit_boss, e.dealer_category::text AS dcat, e.photo_url,
           e.staff_member_id, e.dealer_id
    FROM public.employees e
    WHERE e.casino_id = p_casino_id
  ),
  raw AS (
    SELECT em.emp_id, dd.dt,
           COALESCE(sa.value, da.value) AS val
    FROM emps em
    CROSS JOIN days dd
    LEFT JOIN public.staff_attendance sa
      ON sa.staff_id = em.staff_member_id AND sa.date = dd.dt AND sa.casino_id = p_casino_id
    LEFT JOIN public.dealer_attendance da
      ON da.dealer_id = em.dealer_id AND da.date = dd.dt AND da.casino_id = p_casino_id
  ),
  manual AS (
    SELECT ah.employee_id, ah.date AS dt, ah.hours
    FROM public.attendance_hours ah
    WHERE ah.casino_id = p_casino_id AND ah.date BETWEEN v_start AND v_end
  ),
  hol AS (
    SELECT h.date AS dt, h.multiplier
    FROM public.attendance_holidays h
    WHERE h.casino_id = p_casino_id AND h.date BETWEEN v_start AND v_end
  )
  SELECT
    em.emp_id, em.full_name, em.department, em.pos,
    em.is_pit_boss, em.dcat, em.photo_url,
    r.dt,
    CASE WHEN r.val ~ '^[0-9]+(\.[0-9]+)?$' THEN r.val::NUMERIC ELSE 0 END,
    m.hours,
    COALESCE(m.hours, CASE WHEN r.val ~ '^[0-9]+(\.[0-9]+)?$' THEN r.val::NUMERIC ELSE 0 END),
    r.val,
    (h.dt IS NOT NULL),
    COALESCE(h.multiplier, 1.0)
  FROM emps em
  JOIN raw r ON r.emp_id = em.emp_id
  LEFT JOIN manual m ON m.employee_id = em.emp_id AND m.dt = r.dt
  LEFT JOIN hol h ON h.dt = r.dt
  ORDER BY em.department, em.full_name, r.dt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_attendance(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.payroll_refresh_period(_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period RECORD;
  v_start DATE;
  v_added INT := 0;
  v_updated INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = _period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_period.status = 'locked' THEN RAISE EXCEPTION 'Period is locked'; END IF;

  IF NOT (public.has_role(auth.uid(),'hr'::app_role)
          OR public.has_role(auth.uid(),'finance_manager'::app_role)
          OR public.has_role(auth.uid(),'super_admin'::app_role)
          OR public.has_role(auth.uid(),'manager'::app_role)) THEN
    RAISE EXCEPTION 'HR, Manager, Finance Manager or Super Admin role required';
  END IF;

  v_start := make_date(v_period.year, v_period.month, 1);

  WITH inserted AS (
    INSERT INTO public.payroll_entries (
      period_id, employee_id, casino_id,
      snapshot_full_name, snapshot_position, snapshot_basic_salary,
      snapshot_account_number, snapshot_bank_code, snapshot_branch_code
    )
    SELECT v_period.id, e.id, e.casino_id,
           e.full_name, e.position, e.basic_salary,
           COALESCE(b.account_number,''), COALESCE(b.bank_code,''), COALESCE(b.branch_code,'')
    FROM public.employees e
    LEFT JOIN public.employee_bank_accounts b ON b.employee_id = e.id AND b.is_primary
    WHERE e.casino_id = v_period.casino_id
      AND e.payroll_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.payroll_entries pe
        WHERE pe.period_id = v_period.id AND pe.employee_id = e.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_added FROM inserted;

  WITH att AS (
    SELECT * FROM public.get_monthly_attendance(v_period.casino_id, v_start)
  ),
  agg AS (
    SELECT a.employee_id,
           SUM(CASE WHEN a.is_holiday THEN a.effective_hours ELSE 0 END)::INT AS holiday_hours,
           SUM(CASE WHEN a.is_holiday AND a.effective_hours > 0 THEN 1 ELSE 0 END)::INT AS holiday_days,
           SUM(CASE WHEN UPPER(COALESCE(a.raw_value,'')) = 'A' THEN 1 ELSE 0 END)::INT AS missing_days
    FROM att a
    GROUP BY a.employee_id
  ),
  upd AS (
    UPDATE public.payroll_entries pe
    SET hrs_worked_on_holiday = COALESCE(agg.holiday_hours, 0),
        public_holiday_worked = COALESCE(agg.holiday_days, 0),
        missing_days = COALESCE(agg.missing_days, 0),
        updated_at = now()
    FROM agg
    WHERE pe.period_id = v_period.id AND pe.employee_id = agg.employee_id
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id, details)
  VALUES (v_period.id, v_period.casino_id, 'refresh_period', auth.uid(),
          jsonb_build_object('added', v_added, 'updated', v_updated));

  RETURN jsonb_build_object('added', v_added, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.payroll_refresh_period(UUID) TO authenticated;
