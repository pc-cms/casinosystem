
-- Fast aggregated lifetime visit counts for a casino, optionally restricted to a set of players.
-- Replaces the unbounded fetch in PlayerStatistics that pulled every visit row per player.
CREATE OR REPLACE FUNCTION public.player_lifetime_visit_counts(
  _casino_id uuid,
  _player_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(player_id uuid, visit_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cv.player_id, count(*)::bigint
    FROM public.casino_visits cv
   WHERE cv.casino_id = _casino_id
     AND (_player_ids IS NULL OR cv.player_id = ANY(_player_ids))
   GROUP BY cv.player_id;
$$;

GRANT EXECUTE ON FUNCTION public.player_lifetime_visit_counts(uuid, uuid[]) TO authenticated, service_role;
