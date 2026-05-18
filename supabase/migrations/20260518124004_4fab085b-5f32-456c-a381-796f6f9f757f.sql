INSERT INTO public.cash_counts (
  casino_id, shift_id, count_type, currency, denominations, total, counted_by, created_at
)
SELECT
  s.casino_id,
  s.id,
  'check',
  'ALL',
  jsonb_build_object(
    'chips',  COALESCE(s.closing_count -> 'chips',  '{}'::jsonb),
    'cash',   COALESCE(s.closing_count -> 'cash',   '{}'::jsonb),
    'bank',   COALESCE(s.closing_count -> 'bank',   '{}'::jsonb),
    'mobile', COALESCE(s.closing_count -> 'mobile', '{}'::jsonb),
    'totals', COALESCE(s.closing_count -> 'totals', '{}'::jsonb)
                || jsonb_build_object(
                     'expected',   COALESCE((s.closing_count -> 'totals' ->> 'total_tzs')::numeric, 0),
                     'counted',    COALESCE((s.closing_count -> 'totals' ->> 'total_tzs')::numeric, 0),
                     'difference', 0,
                     'balanced',   true,
                     'is_closing', true,
                     'backfilled', true
                   )
  ),
  COALESCE((s.closing_count -> 'totals' ->> 'total_tzs')::numeric, 0)::bigint,
  COALESCE(s.closed_by, s.opened_by),
  COALESCE(s.closed_at, now())
FROM public.shifts s
WHERE s.status = 'closed'
  AND s.closing_count IS NOT NULL
  AND s.closing_count <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_counts cc
    WHERE cc.shift_id = s.id
      AND cc.count_type = 'check'
      AND (cc.denominations -> 'totals' ->> 'is_closing') = 'true'
  );
