
-- ================================================================
-- GLOBAL PLAYER BASE: Make players visible across all casinos
-- Blacklist is automatically global since status lives on the player
-- ================================================================

-- 1. Drop old casino-scoped SELECT policies on players
DROP POLICY IF EXISTS "Casino users see players" ON public.players;
DROP POLICY IF EXISTS "Super admins see all players" ON public.players;

-- 2. Create new global SELECT policy — all authenticated users see all players
CREATE POLICY "All authenticated users see all players"
  ON public.players FOR SELECT TO authenticated
  USING (true);

-- 3. Keep INSERT scoped to user's casino (registration origin)
-- Already exists: players insert uses casino_id = get_user_casino_id(auth.uid())
-- No change needed for insert policies

-- 4. Update duplicate check to be CROSS-CASINO
CREATE OR REPLACE FUNCTION public.prevent_duplicate_player()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.players
    WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(NEW.first_name))
      AND LOWER(TRIM(last_name)) = LOWER(TRIM(NEW.last_name))
      AND TRIM(phone) = TRIM(NEW.phone)
      AND phone != ''
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Player with same name and phone already exists';
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Make player_cards globally visible (they reference players which are now global)
DROP POLICY IF EXISTS "Casino users see cards" ON public.player_cards;
CREATE POLICY "All authenticated users see cards"
  ON public.player_cards FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins see all player cards" ON public.player_cards;

-- 6. Make player_tags globally visible
DROP POLICY IF EXISTS "Casino users see tags" ON public.player_tags;
DROP POLICY IF EXISTS "Super admins see all tags" ON public.player_tags;
CREATE POLICY "All authenticated users see tags"
  ON public.player_tags FOR SELECT TO authenticated
  USING (true);

-- 7. Make player_notes readable by all (casino context kept for write)
DROP POLICY IF EXISTS "Casino users see player notes" ON public.player_notes;
CREATE POLICY "All authenticated users see player notes"
  ON public.player_notes FOR SELECT TO authenticated
  USING (true);

-- 8. Make player_groups global read (groups are per-casino but visible)
-- Keep as-is: groups are casino-scoped which is correct

-- 9. Update player_economy view to be globally readable
-- (it's a view, RLS follows the base tables which are now global)
