-- Step 1: close non-keeper open duplicates so partial open-visit index allows merge.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY casino_id, player_id, date ORDER BY checked_in_at ASC, id ASC) AS rn
  FROM public.casino_visits
)
UPDATE public.casino_visits cv
SET checked_out_at = COALESCE(cv.checked_out_at, now())
FROM ranked r
WHERE cv.id = r.id AND r.rn > 1;

-- Step 2: keeper row gets merged time range.
WITH agg AS (
  SELECT casino_id, player_id, date,
    MIN(checked_in_at) AS min_in,
    BOOL_OR(checked_out_at IS NULL) AS any_open,
    MAX(checked_out_at) AS max_out
  FROM public.casino_visits
  GROUP BY 1,2,3
  HAVING COUNT(*) > 1
),
keepers AS (
  SELECT DISTINCT ON (cv.casino_id, cv.player_id, cv.date)
    cv.id, cv.casino_id, cv.player_id, cv.date
  FROM public.casino_visits cv
  JOIN agg USING (casino_id, player_id, date)
  ORDER BY cv.casino_id, cv.player_id, cv.date, cv.checked_in_at ASC, cv.id ASC
)
UPDATE public.casino_visits cv
SET checked_in_at = a.min_in,
    checked_out_at = CASE WHEN a.any_open THEN NULL ELSE a.max_out END
FROM agg a, keepers k
WHERE cv.id = k.id
  AND k.casino_id = a.casino_id
  AND k.player_id = a.player_id
  AND k.date = a.date;

-- Step 3: repoint position-history rows from duplicates to keeper.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY casino_id, player_id, date ORDER BY checked_in_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY casino_id, player_id, date ORDER BY checked_in_at ASC, id ASC) AS keep_id
  FROM public.casino_visits
)
UPDATE public.player_position_history pph
SET visit_id = r.keep_id
FROM ranked r
WHERE pph.visit_id = r.id AND r.rn > 1;

-- Step 4: delete duplicate visit rows.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY casino_id, player_id, date ORDER BY checked_in_at ASC, id ASC) AS rn
  FROM public.casino_visits
)
DELETE FROM public.casino_visits cv
USING ranked r
WHERE cv.id = r.id AND r.rn > 1;

-- Step 5: restore strict uniqueness — one visit per player per casino per day.
ALTER TABLE public.casino_visits
  ADD CONSTRAINT casino_visits_casino_id_player_id_date_key
  UNIQUE (casino_id, player_id, date);