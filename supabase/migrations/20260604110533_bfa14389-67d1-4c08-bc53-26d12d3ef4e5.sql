
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS full_name text
  GENERATED ALWAYS AS (TRIM(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) STORED;
