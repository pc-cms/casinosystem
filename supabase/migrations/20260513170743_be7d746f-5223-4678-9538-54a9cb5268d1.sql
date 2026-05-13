
DROP VIEW IF EXISTS public.payroll_bank_export_v;
CREATE VIEW public.payroll_bank_export_v WITH (security_invoker = true) AS
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
  FROM base WHERE account_number <> ''
  GROUP BY period_id, account_number
)
SELECT b.*,
  CASE
    WHEN b.account_number = ''  THEN 'missing_account'
    WHEN b.amount < 0           THEN 'negative_salary'
    WHEN b.amount = 0           THEN 'zero_salary'
    WHEN d.c > 1                THEN 'duplicate_account'
    ELSE NULL END AS warning
FROM base b
LEFT JOIN dups d ON d.period_id = b.period_id AND d.account_number = b.account_number;

GRANT SELECT ON public.payroll_bank_export_v TO authenticated;
