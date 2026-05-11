UPDATE public.shifts
SET
  cash_result = GREATEST(
    COALESCE((closing_count->'totals'->>'total_tzs')::numeric, 0)
    - COALESCE((closing_count->'totals'->>'chips_tzs')::numeric, 0),
    0
  ),
  closing_cash = COALESCE(closing_cash, '{}'::jsonb) || jsonb_build_object(
    'cash_result', GREATEST(
      COALESCE((closing_count->'totals'->>'total_tzs')::numeric, 0)
      - COALESCE((closing_count->'totals'->>'chips_tzs')::numeric, 0),
      0
    )
  )
WHERE status = 'closed'
  AND closing_count IS NOT NULL
  AND (closing_count->'totals'->>'total_tzs') IS NOT NULL;