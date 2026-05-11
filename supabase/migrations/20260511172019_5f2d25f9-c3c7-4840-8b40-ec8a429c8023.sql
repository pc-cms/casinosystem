WITH agg AS (
  SELECT
    s.id,
    COALESCE((s.closing_count->'totals'->>'total_tzs')::numeric, 0)
      - COALESCE((s.closing_count->'totals'->>'chips_tzs')::numeric, 0) AS closing_cash,
    GREATEST(
      COALESCE((s.opening_float->'totals'->>'total_tzs')::numeric, 0)
        - COALESCE((s.opening_float->'totals'->>'chips_tzs')::numeric, 0),
      0
    ) AS opening_cash,
    COALESCE((SELECT SUM(amount) FROM public.cage_transfers ct
              WHERE ct.shift_id = s.id AND ct.transfer_type = 'add_float'), 0) AS float_added,
    COALESCE((SELECT SUM(amount) FROM public.cage_transfers ct
              WHERE ct.shift_id = s.id AND ct.transfer_type = 'collection'), 0) AS collection_total,
    COALESCE(s.miss_total, 0) AS miss_total
  FROM public.shifts s
  WHERE s.status = 'closed'
    AND s.closing_count IS NOT NULL
    AND s.opening_float IS NOT NULL
)
UPDATE public.shifts s
SET cash_result = (a.closing_cash - (a.opening_cash - a.float_added + a.collection_total))::bigint,
    shift_result = ((a.closing_cash - (a.opening_cash - a.float_added + a.collection_total)) + a.miss_total)::bigint,
    closing_cash = jsonb_set(
      jsonb_set(
        COALESCE(s.closing_cash, '{}'::jsonb),
        '{cash_result}',
        to_jsonb((a.closing_cash - (a.opening_cash - a.float_added + a.collection_total))::bigint)
      ),
      '{shift_result}',
      to_jsonb(((a.closing_cash - (a.opening_cash - a.float_added + a.collection_total)) + a.miss_total)::bigint)
    )
FROM agg a
WHERE s.id = a.id;