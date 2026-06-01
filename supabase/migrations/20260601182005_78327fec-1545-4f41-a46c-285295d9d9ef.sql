ALTER TABLE public.cage_slots_tips_cd
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'day'
  CHECK (bucket IN ('day','evening'));

-- Backfill existing rows from today (EAT) using legacy time-based rule:
-- day = 13:00..21:10 EAT, evening otherwise
UPDATE public.cage_slots_tips_cd
SET bucket = CASE
  WHEN (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')) * 60
      + EXTRACT(MINUTE FROM (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')))::int
      BETWEEN 13*60 AND 21*60+10
  THEN 'day' ELSE 'evening' END
WHERE created_at >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - INTERVAL '1 day';