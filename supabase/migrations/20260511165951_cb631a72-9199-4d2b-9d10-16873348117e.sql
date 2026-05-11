-- Net cash result = closing cash − opening cash (excludes starting float)
UPDATE public.shifts
SET cash_result = GREATEST(
  COALESCE((closing_count->'totals'->>'total_tzs')::bigint, 0)
    - COALESCE((closing_count->'totals'->>'chips_tzs')::bigint, 0)
    - GREATEST(
        COALESCE((opening_float->'totals'->>'total_tzs')::bigint, 0)
          - COALESCE((opening_float->'totals'->>'chips_tzs')::bigint, 0),
        0
      ),
  -COALESCE((opening_float->'totals'->>'total_tzs')::bigint, 0)
)
WHERE status = 'closed'
  AND closing_count IS NOT NULL
  AND opening_float IS NOT NULL;

-- Strip legacy auto-appended trail from notes
UPDATE public.shifts
SET notes = NULLIF(
  TRIM(regexp_replace(notes, '\s*\|\s*(TABLES|CASH|MISS|BALANCE|RESULT|DIFF|mgr)\b.*$', '', 'i')),
  ''
)
WHERE status = 'closed'
  AND notes IS NOT NULL
  AND notes ~* '\|\s*(TABLES|CASH|MISS|BALANCE|RESULT|DIFF|mgr)\b';
