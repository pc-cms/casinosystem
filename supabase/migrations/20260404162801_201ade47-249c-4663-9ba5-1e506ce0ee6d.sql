
-- 1. Security definer function: check if player has active visit in ANY casino
CREATE OR REPLACE FUNCTION public.player_active_visit_casino(_player_id uuid)
  RETURNS TABLE(casino_id uuid, casino_name text, checked_in_at timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT cv.casino_id, c.name, cv.checked_in_at
  FROM public.casino_visits cv
  JOIN public.casinos c ON c.id = cv.casino_id
  WHERE cv.player_id = _player_id
    AND cv.checked_out_at IS NULL
    AND cv.date >= CURRENT_DATE - 1
  LIMIT 1;
$$;

-- 2. Add realtime for players table (already in publication but ensure)
-- Already done in previous migration

-- 3. Ensure player_notes has proper cross-casino edit tracking
-- (casino_id already captures which casino added the note)
