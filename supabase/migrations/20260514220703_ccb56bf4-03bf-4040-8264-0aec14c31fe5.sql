CREATE OR REPLACE FUNCTION public.set_player_category(_player_id uuid, _category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _category NOT IN ('normal','gold','platinum','diamond') THEN
    RAISE EXCEPTION 'Invalid category: %', _category;
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'floor_manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized to change player category';
  END IF;
  UPDATE public.players SET category = _category::player_category WHERE id = _player_id;
END;
$function$;