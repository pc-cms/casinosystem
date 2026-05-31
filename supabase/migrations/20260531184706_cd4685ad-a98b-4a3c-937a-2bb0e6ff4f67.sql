-- Fix expense source/cage routing: source is the source of truth.
-- 1) Re-derive cage_type from source (not from cage_slots_shift_id), and
--    clear conflicting shift links so a Live expense never holds a slots shift.
CREATE OR REPLACE FUNCTION public.set_expense_cage_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Source is authoritative. Normalize cage_type and shift links to match.
  IF COALESCE(NEW.source, 'live_game') = 'slots' THEN
    NEW.cage_type := 'slots';
    NEW.shift_id  := NULL;
  ELSIF COALESCE(NEW.source, 'live_game') = 'live_game' THEN
    NEW.cage_type := 'live_game';
    NEW.cage_slots_shift_id := NULL;
  ELSE
    -- office handled by expenses_office_before_insert
    NEW.cage_type := COALESCE(NEW.cage_type, 'live_game');
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Auto-link to open Live shift whenever source = 'live_game' and
--    shift_id is missing (cage_slots_shift_id was already cleared above).
CREATE OR REPLACE FUNCTION public.validate_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;
  IF NEW.category IS NULL THEN
    RAISE EXCEPTION 'Expense must have a category';
  END IF;
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Expense must have a creator';
  END IF;

  IF NEW.shift_id IS NULL
     AND COALESCE(NEW.source, 'live_game') = 'live_game'
     AND COALESCE(NEW.cage_type, 'live_game') = 'live_game' THEN
    SELECT id INTO NEW.shift_id
    FROM public.shifts
    WHERE casino_id = NEW.casino_id AND status = 'open'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Re-attach the stuck Live Game expense (source='live_game' but linked to
--    a slots shift) to the currently open Live shift, then recompute balances.
UPDATE public.expenses e
   SET cage_type           = 'live_game',
       cage_slots_shift_id = NULL,
       shift_id            = (SELECT id FROM public.shifts
                              WHERE casino_id = e.casino_id AND status = 'open'
                              LIMIT 1)
 WHERE e.source = 'live_game'
   AND e.cage_slots_shift_id IS NOT NULL
   AND e.shift_id IS NULL
   AND EXISTS (SELECT 1 FROM public.shifts s
                WHERE s.casino_id = e.casino_id AND s.status = 'open');