CREATE OR REPLACE FUNCTION public.check_one_dealer_per_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slot text;
  v_existing_count int;
  v_role text;
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := NEW.role::text;

  IF v_role ~ 'c$' THEN
    v_slot := 'C';
  ELSIF v_role ~ 'i$' THEN
    v_slot := 'I';
  ELSE
    v_slot := 'D';
  END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.breaklist
  WHERE casino_id = NEW.casino_id
    AND date = NEW.date
    AND time_slot = NEW.time_slot
    AND table_id = NEW.table_id
    AND employee_id <> NEW.employee_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND CASE
          WHEN role::text ~ 'c$' THEN 'C'
          WHEN role::text ~ 'i$' THEN 'I'
          ELSE 'D'
        END = v_slot;

  IF v_existing_count > 0 THEN
    IF v_slot = 'C' THEN
      RAISE EXCEPTION 'This table already has a chipper for this time slot';
    ELSIF v_slot = 'I' THEN
      RAISE EXCEPTION 'This table already has an inspector for this time slot';
    ELSE
      RAISE EXCEPTION 'This table already has a dealer for this time slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;