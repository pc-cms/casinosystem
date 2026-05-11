UPDATE public.shifts
SET notes = NULLIF(
  TRIM(BOTH ' |' FROM TRIM(regexp_replace(notes, E'\\s*\\|\\s*(TABLES|CASH|MISS|BALANCE|RESULT|DIFF|mgr)[^|]*(\\|[^|]*)*$', '', 'i'))),
  ''
)
WHERE status = 'closed'
  AND notes IS NOT NULL
  AND notes ~* E'\\|\\s*(TABLES|CASH|MISS|BALANCE|RESULT|DIFF|mgr)';
