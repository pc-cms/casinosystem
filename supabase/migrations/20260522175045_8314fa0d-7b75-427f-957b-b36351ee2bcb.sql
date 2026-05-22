CREATE OR REPLACE FUNCTION public.check_one_dealer_per_slot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slot text;
  v_existing record;
  v_occupant_name text;
  v_casino_name text;
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role::text ~ 'c$' THEN
    v_slot := 'C';
  ELSIF NEW.role::text ~ 'i$' THEN
    v_slot := 'I';
  ELSE
    v_slot := 'D';
  END IF;

  SELECT b.id, b.employee_id, b.role
    INTO v_existing
  FROM public.breaklist b
  WHERE b.casino_id = NEW.casino_id
    AND b.date = NEW.date
    AND b.time_slot = NEW.time_slot
    AND b.table_id = NEW.table_id
    AND b.employee_id <> NEW.employee_id
    AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND CASE
          WHEN b.role::text ~ 'c$' THEN 'C'
          WHEN b.role::text ~ 'i$' THEN 'I'
          ELSE 'D'
        END = v_slot
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    SELECT full_name INTO v_occupant_name FROM public.employees WHERE id = v_existing.employee_id;
    SELECT name INTO v_casino_name FROM public.casinos WHERE id = NEW.casino_id;

    IF v_slot = 'C' THEN
      RAISE EXCEPTION 'Chipper slot already taken by % (%) at this time at %', COALESCE(v_occupant_name, 'another dealer'), v_existing.role, COALESCE(v_casino_name, 'this casino');
    ELSIF v_slot = 'I' THEN
      RAISE EXCEPTION 'Inspector slot already taken by % (%) at this time at %', COALESCE(v_occupant_name, 'another dealer'), v_existing.role, COALESCE(v_casino_name, 'this casino');
    ELSE
      RAISE EXCEPTION 'Dealer slot already taken by % (%) at this time at %', COALESCE(v_occupant_name, 'another dealer'), v_existing.role, COALESCE(v_casino_name, 'this casino');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;