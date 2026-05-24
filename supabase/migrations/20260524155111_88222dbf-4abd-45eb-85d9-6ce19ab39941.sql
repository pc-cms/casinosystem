
-- 1. staff_warnings table
CREATE TABLE IF NOT EXISTS public.staff_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('absent','suspend','sick','late')),
  comment text DEFAULT '' NOT NULL,
  source_table text NOT NULL DEFAULT 'dealer_attendance',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, employee_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_warnings_casino_date
  ON public.staff_warnings (casino_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_warnings_employee
  ON public.staff_warnings (casino_id, employee_id, business_date DESC);

ALTER TABLE public.staff_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View staff warnings in casino" ON public.staff_warnings
  FOR SELECT TO authenticated
  USING (
    (casino_id = get_user_casino_id(auth.uid()) AND (
      has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'floor_manager'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
    ))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Manage staff warnings" ON public.staff_warnings
  FOR ALL TO authenticated
  USING (
    (casino_id = get_user_casino_id(auth.uid()) AND (
      has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'floor_manager'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
    ))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (casino_id = get_user_casino_id(auth.uid()) AND (
      has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'floor_manager'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
    ))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.update_staff_warnings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_staff_warnings_updated
  BEFORE UPDATE ON public.staff_warnings
  FOR EACH ROW EXECUTE FUNCTION public.update_staff_warnings_updated_at();

-- 2. Attendance → staff_warnings sync trigger
CREATE OR REPLACE FUNCTION public.tg_sync_staff_warnings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text;
  v_raw text;
  v_casino uuid;
  v_emp uuid;
  v_date date;
  v_recorder uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.staff_warnings
      WHERE casino_id = OLD.casino_id
        AND employee_id = OLD.employee_id
        AND business_date = OLD.date
        AND source_table = TG_TABLE_NAME;
    RETURN OLD;
  END IF;

  v_casino := NEW.casino_id;
  v_emp := NEW.employee_id;
  v_date := NEW.date;
  v_recorder := NEW.recorded_by;
  v_raw := upper(coalesce(NEW.value, ''));

  v_kind := CASE
    WHEN v_raw = 'A' THEN 'absent'
    WHEN v_raw = 'SP' THEN 'suspend'
    WHEN v_raw = 'S' OR v_raw ~ '^[0-9]+S$' THEN 'sick'
    WHEN v_raw = 'L' OR v_raw ~ '^[0-9]+L$' THEN 'late'
    ELSE NULL
  END;

  IF v_kind IS NULL THEN
    DELETE FROM public.staff_warnings
      WHERE casino_id = v_casino
        AND employee_id = v_emp
        AND business_date = v_date
        AND source_table = TG_TABLE_NAME;
    RETURN NEW;
  END IF;

  INSERT INTO public.staff_warnings
    (casino_id, employee_id, business_date, kind, source_table, created_by)
  VALUES (v_casino, v_emp, v_date, v_kind, TG_TABLE_NAME, v_recorder)
  ON CONFLICT (casino_id, employee_id, business_date) DO UPDATE
    SET kind = EXCLUDED.kind,
        source_table = EXCLUDED.source_table,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dealer_attendance_warnings ON public.dealer_attendance;
CREATE TRIGGER trg_dealer_attendance_warnings
  AFTER INSERT OR UPDATE OR DELETE ON public.dealer_attendance
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_staff_warnings();

DROP TRIGGER IF EXISTS trg_staff_attendance_warnings ON public.staff_attendance;
CREATE TRIGGER trg_staff_attendance_warnings
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_staff_warnings();

-- 3. role_module_defaults — add tips_and_bonuses + hr_warnings
INSERT INTO public.role_module_defaults (role, module_key, can_view, can_write)
VALUES
  ('manager'::app_role,         'tips_and_bonuses', true, true),
  ('floor_manager'::app_role,   'tips_and_bonuses', true, true),
  ('finance_manager'::app_role, 'tips_and_bonuses', true, false),
  ('surveillance'::app_role,    'tips_and_bonuses', true, false),
  ('super_admin'::app_role,     'tips_and_bonuses', true, true),
  ('hr'::app_role,              'hr_warnings',      true, true),
  ('manager'::app_role,         'hr_warnings',      true, true),
  ('finance_manager'::app_role, 'hr_warnings',      true, false),
  ('super_admin'::app_role,     'hr_warnings',      true, true)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view, can_write = EXCLUDED.can_write;

-- Backfill: scan existing attendance to populate warnings
INSERT INTO public.staff_warnings (casino_id, employee_id, business_date, kind, source_table, created_by)
SELECT casino_id, employee_id, date,
  CASE upper(value)
    WHEN 'A' THEN 'absent'
    WHEN 'SP' THEN 'suspend'
    WHEN 'S' THEN 'sick'
    WHEN 'L' THEN 'late'
    ELSE (CASE WHEN upper(value) ~ '^[0-9]+S$' THEN 'sick'
               WHEN upper(value) ~ '^[0-9]+L$' THEN 'late'
               ELSE NULL END)
  END AS kind,
  'dealer_attendance', recorded_by
FROM public.dealer_attendance
WHERE upper(coalesce(value,'')) IN ('A','SP','S','L')
   OR upper(coalesce(value,'')) ~ '^[0-9]+S$'
   OR upper(coalesce(value,'')) ~ '^[0-9]+L$'
ON CONFLICT (casino_id, employee_id, business_date) DO NOTHING;

INSERT INTO public.staff_warnings (casino_id, employee_id, business_date, kind, source_table, created_by)
SELECT casino_id, employee_id, date,
  CASE upper(value)
    WHEN 'A' THEN 'absent'
    WHEN 'SP' THEN 'suspend'
    WHEN 'S' THEN 'sick'
    WHEN 'L' THEN 'late'
    ELSE (CASE WHEN upper(value) ~ '^[0-9]+S$' THEN 'sick'
               WHEN upper(value) ~ '^[0-9]+L$' THEN 'late'
               ELSE NULL END)
  END AS kind,
  'staff_attendance', recorded_by
FROM public.staff_attendance
WHERE upper(coalesce(value,'')) IN ('A','SP','S','L')
   OR upper(coalesce(value,'')) ~ '^[0-9]+S$'
   OR upper(coalesce(value,'')) ~ '^[0-9]+L$'
ON CONFLICT (casino_id, employee_id, business_date) DO NOTHING;
