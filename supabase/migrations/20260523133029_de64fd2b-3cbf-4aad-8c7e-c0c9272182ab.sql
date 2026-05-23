-- Normalize player_cards.card_number: strip 'CMS' prefix and trailing '+'
UPDATE public.player_cards
SET card_number = regexp_replace(card_number, '^CMS(\d+)\+$', '\1')
WHERE card_number ~ '^CMS\d+\+$';

-- Update generator to emit clean digits only
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN LPAD(nextval('public.card_number_seq')::TEXT, 6, '0');
END;
$function$;

-- Soft format check for future inserts
ALTER TABLE public.player_cards
  DROP CONSTRAINT IF EXISTS card_number_format;
ALTER TABLE public.player_cards
  ADD CONSTRAINT card_number_format CHECK (card_number ~ '^\d{4,}$') NOT VALID;
ALTER TABLE public.player_cards VALIDATE CONSTRAINT card_number_format;