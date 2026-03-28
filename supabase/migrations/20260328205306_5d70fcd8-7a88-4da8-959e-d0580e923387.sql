-- Fix 1: Card number generation - reset sequence past existing max
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN card_number ~ '^0001[0-9]+\+$' 
      THEN CAST(REPLACE(REPLACE(card_number, '0001', ''), '+', '') AS INTEGER)
      ELSE 0 
    END
  ), 0) INTO max_seq FROM public.player_cards;
  
  IF max_seq > 0 THEN
    PERFORM setval('public.card_number_seq', max_seq + 1, false);
  END IF;
END $$;

-- Update generate_card_number to use 6-digit padding and new prefix
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'CMS' || LPAD(nextval('public.card_number_seq')::TEXT, 6, '0') || '+';
END;
$$;

-- Fix 2: chip_snapshots.miss - change from generated to regular column with trigger
ALTER TABLE public.chip_snapshots ALTER COLUMN miss DROP EXPRESSION IF EXISTS;

-- Create trigger to auto-calculate miss
CREATE OR REPLACE FUNCTION public.calc_chip_miss()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.miss := NEW.actual_quantity - NEW.expected_quantity;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_chip_miss
BEFORE INSERT OR UPDATE ON public.chip_snapshots
FOR EACH ROW EXECUTE FUNCTION public.calc_chip_miss();