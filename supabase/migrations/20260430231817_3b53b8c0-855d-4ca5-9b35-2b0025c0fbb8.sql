-- One open session per player (network-wide), not per (player, table).
-- A player physically cannot sit at two tables at the same time.

DROP INDEX IF EXISTS public.uniq_client_sessions_open_per_player_table;

-- Safety: auto-close any stale duplicates (keep most recent open one)
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY player_id ORDER BY started_at DESC, created_at DESC) AS rn
  FROM public.client_sessions
  WHERE stopped_at IS NULL
)
UPDATE public.client_sessions s
SET stopped_at = now()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX uniq_client_sessions_open_per_player
  ON public.client_sessions (player_id)
  WHERE stopped_at IS NULL;