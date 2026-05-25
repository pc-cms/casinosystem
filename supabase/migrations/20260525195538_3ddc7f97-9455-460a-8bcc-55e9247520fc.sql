ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cage_slots_shift_id uuid REFERENCES public.cage_slots_shifts(id);

CREATE INDEX IF NOT EXISTS idx_expenses_cage_slots_shift_id
  ON public.expenses (cage_slots_shift_id);

CREATE OR REPLACE FUNCTION public.set_expense_cage_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cage_slots_shift_id IS NOT NULL THEN
    NEW.cage_type := 'slots';
  ELSIF NEW.shift_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.cage_slots_shifts s WHERE s.id = NEW.shift_id) THEN
    NEW.cage_type := 'slots';
  ELSE
    NEW.cage_type := COALESCE(NEW.cage_type, 'live_game');
  END IF;
  RETURN NEW;
END;
$$;