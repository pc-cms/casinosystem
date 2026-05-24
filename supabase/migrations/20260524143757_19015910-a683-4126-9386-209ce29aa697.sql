ALTER TABLE public.gaming_tables
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill: group by game (AR first, then BG, then Poker/Holdem, then others), then by name
WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY casino_id
      ORDER BY
        CASE
          WHEN game ILIKE '%roulette%' THEN 1
          WHEN game ILIKE '%blackjack%' THEN 2
          WHEN game ILIKE '%poker%' OR game ILIKE '%holdem%' THEN 3
          ELSE 4
        END,
        name
    ) * 10 AS new_order
  FROM public.gaming_tables
)
UPDATE public.gaming_tables gt
SET display_order = ordered.new_order
FROM ordered
WHERE ordered.id = gt.id AND gt.display_order = 0;

CREATE INDEX IF NOT EXISTS idx_gaming_tables_casino_order
  ON public.gaming_tables (casino_id, is_archived, display_order);