
-- 1. Extend status check to include 'paid'
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check
  CHECK (status IN ('draft','hr_approved','locked','paid'));

-- 2. New columns
ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_description text,
  ADD COLUMN IF NOT EXISTS branch_label text;

-- 3. Settings extras
ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS off_day_multiplier numeric(5,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS default_payment_description text;

-- 4. PAYE brackets
CREATE TABLE IF NOT EXISTS public.payroll_paye_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ord int NOT NULL,
  lower_bound bigint NOT NULL,
  upper_bound bigint,
  base_tax bigint NOT NULL DEFAULT 0,
  rate_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, effective_from, ord)
);

ALTER TABLE public.payroll_paye_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paye_brackets_select" ON public.payroll_paye_brackets FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role)
      OR has_role(auth.uid(),'finance_manager'::app_role)
      OR (has_role(auth.uid(),'hr'::app_role) AND casino_id = get_user_casino_id(auth.uid())));

CREATE POLICY "paye_brackets_write_super" ON public.payroll_paye_brackets FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

-- Seed defaults for every casino
INSERT INTO public.payroll_paye_brackets (casino_id, effective_from, ord, lower_bound, upper_bound, base_tax, rate_pct)
SELECT c.id, '2024-01-01'::date, b.ord, b.lo, b.hi, b.base, b.rate
FROM public.casinos c
CROSS JOIN (VALUES
  (1, 0::bigint,        270000::bigint,  0::bigint,        0::numeric),
  (2, 270001::bigint,   520000::bigint,  0::bigint,        9::numeric),
  (3, 520001::bigint,   760000::bigint,  22500::bigint,    20::numeric),
  (4, 760001::bigint,  1000000::bigint,  70500::bigint,    25::numeric),
  (5, 1000001::bigint,  NULL::bigint,    130500::bigint,   30::numeric)
) AS b(ord, lo, hi, base, rate)
ON CONFLICT (casino_id, effective_from, ord) DO NOTHING;

-- 5. Mark Paid RPC
CREATE OR REPLACE FUNCTION public.payroll_mark_paid(_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_p public.payroll_periods%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(),'finance_manager'::app_role)
          OR has_role(auth.uid(),'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Finance Manager or Super Admin role required';
  END IF;
  SELECT * INTO v_p FROM public.payroll_periods WHERE id = _period_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF;
  IF v_p.status <> 'locked' THEN RAISE EXCEPTION 'Period must be Approved (locked) before marking Paid'; END IF;

  UPDATE public.payroll_periods
     SET status='paid', paid_by=auth.uid(), paid_at=now()
   WHERE id=_period_id;

  INSERT INTO public.payroll_audit_log(period_id, casino_id, action, actor_id)
  VALUES (_period_id, v_p.casino_id, 'mark_paid', auth.uid());
END;
$$;

-- 6. Bank export validation view
CREATE OR REPLACE VIEW public.payroll_bank_export_v AS
WITH base AS (
  SELECT
    e.id, e.period_id, e.employee_id, e.casino_id,
    e.snapshot_full_name AS name,
    e.snapshot_account_number AS account_number,
    e.snapshot_bank_code AS bank_code,
    e.snapshot_branch_code AS branch_code,
    e.net_salary AS amount
  FROM public.payroll_entries e
),
dups AS (
  SELECT period_id, account_number, count(*) AS c
  FROM base
  WHERE account_number <> ''
  GROUP BY period_id, account_number
)
SELECT
  b.*,
  CASE
    WHEN b.account_number = ''        THEN 'missing_account'
    WHEN b.amount < 0                  THEN 'negative_salary'
    WHEN b.amount = 0                  THEN 'zero_salary'
    WHEN d.c > 1                       THEN 'duplicate_account'
    ELSE NULL
  END AS warning
FROM base b
LEFT JOIN dups d ON d.period_id = b.period_id AND d.account_number = b.account_number;

GRANT SELECT ON public.payroll_bank_export_v TO authenticated;
