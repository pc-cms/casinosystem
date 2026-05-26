-- Employee role history (effective-dated)
CREATE TABLE public.employee_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  department text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  dealer_category text,
  is_pit_boss boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_from)
);

GRANT SELECT ON public.employee_role_history TO authenticated;
GRANT ALL ON public.employee_role_history TO service_role;

CREATE INDEX idx_erh_emp_eff ON public.employee_role_history (employee_id, effective_from DESC);

ALTER TABLE public.employee_role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see role history"
  ON public.employee_role_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_role_history.employee_id AND e.casino_id = get_user_casino_id(auth.uid())));

INSERT INTO public.employee_role_history (employee_id, effective_from, department, position, dealer_category, is_pit_boss)
SELECT id,
       COALESCE(onboarding_date, employment_date, created_at::date, CURRENT_DATE),
       COALESCE(department,''),
       COALESCE(position,''),
       dealer_category,
       is_pit_boss
FROM public.employees
ON CONFLICT (employee_id, effective_from) DO NOTHING;

CREATE OR REPLACE FUNCTION public.track_employee_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.employee_role_history (employee_id, effective_from, department, position, dealer_category, is_pit_boss)
    VALUES (NEW.id,
            COALESCE(NEW.onboarding_date, NEW.employment_date, NEW.created_at::date, CURRENT_DATE),
            COALESCE(NEW.department,''), COALESCE(NEW.position,''),
            NEW.dealer_category, NEW.is_pit_boss)
    ON CONFLICT (employee_id, effective_from) DO UPDATE
      SET department = EXCLUDED.department,
          position = EXCLUDED.position,
          dealer_category = EXCLUDED.dealer_category,
          is_pit_boss = EXCLUDED.is_pit_boss;
    RETURN NEW;
  END IF;
  IF (NEW.department IS DISTINCT FROM OLD.department)
     OR (NEW.position IS DISTINCT FROM OLD.position)
     OR (NEW.dealer_category IS DISTINCT FROM OLD.dealer_category)
     OR (NEW.is_pit_boss IS DISTINCT FROM OLD.is_pit_boss) THEN
    INSERT INTO public.employee_role_history (employee_id, effective_from, department, position, dealer_category, is_pit_boss)
    VALUES (NEW.id, CURRENT_DATE,
            COALESCE(NEW.department,''), COALESCE(NEW.position,''),
            NEW.dealer_category, NEW.is_pit_boss)
    ON CONFLICT (employee_id, effective_from) DO UPDATE
      SET department = EXCLUDED.department,
          position = EXCLUDED.position,
          dealer_category = EXCLUDED.dealer_category,
          is_pit_boss = EXCLUDED.is_pit_boss;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_track_employee_role_change
AFTER INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.track_employee_role_change();

CREATE OR REPLACE FUNCTION public.employee_roles_at(_casino_id uuid, _on_date date)
RETURNS TABLE (employee_id uuid, department text, job_position text, dealer_category text, is_pit_boss boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (h.employee_id)
    h.employee_id, h.department, h.position AS job_position, h.dealer_category, h.is_pit_boss
  FROM public.employee_role_history h
  JOIN public.employees e ON e.id = h.employee_id
  WHERE e.casino_id = _casino_id
    AND h.effective_from <= _on_date
  ORDER BY h.employee_id, h.effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.employee_roles_at(uuid, date) TO authenticated;

-- Rota Locks
CREATE TABLE public.rota_locks (
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('pit','floor','security','office')),
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  locked_by uuid NOT NULL REFERENCES auth.users(id),
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (casino_id, scope, month)
);

GRANT SELECT, INSERT, DELETE ON public.rota_locks TO authenticated;
GRANT ALL ON public.rota_locks TO service_role;

ALTER TABLE public.rota_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see rota locks"
  ON public.rota_locks FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Manager/HR/SuperAdmin lock month"
  ON public.rota_locks FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'super_admin'))
  );

CREATE POLICY "Manager/HR/SuperAdmin unlock month"
  ON public.rota_locks FOR DELETE TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'super_admin'))
  );

CREATE OR REPLACE FUNCTION public.staff_rota_scope(_employee_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN department = 'Security' THEN 'security'
    WHEN department = 'Office'   THEN 'office'
    ELSE 'floor'
  END FROM public.employees WHERE id = _employee_id;
$$;

CREATE OR REPLACE FUNCTION public.guard_pit_rota_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _date date; _casino uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _date := OLD.date; _casino := OLD.casino_id;
  ELSE _date := NEW.date; _casino := NEW.casino_id; END IF;
  IF EXISTS (SELECT 1 FROM public.rota_locks
             WHERE casino_id = _casino AND scope = 'pit'
               AND month = date_trunc('month', _date)::date) THEN
    RAISE EXCEPTION 'Rota is locked for this month' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER trg_guard_pit_rota_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.pit_rota
FOR EACH ROW EXECUTE FUNCTION public.guard_pit_rota_lock();

CREATE OR REPLACE FUNCTION public.guard_staff_rota_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _date date; _casino uuid; _emp uuid; _scope text;
BEGIN
  IF TG_OP = 'DELETE' THEN _date := OLD.date; _casino := OLD.casino_id; _emp := OLD.employee_id;
  ELSE _date := NEW.date; _casino := NEW.casino_id; _emp := NEW.employee_id; END IF;
  _scope := COALESCE(public.staff_rota_scope(_emp), 'floor');
  IF EXISTS (SELECT 1 FROM public.rota_locks
             WHERE casino_id = _casino AND scope = _scope
               AND month = date_trunc('month', _date)::date) THEN
    RAISE EXCEPTION 'Rota is locked for this month' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER trg_guard_staff_rota_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.staff_rota
FOR EACH ROW EXECUTE FUNCTION public.guard_staff_rota_lock();