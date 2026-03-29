
-- Replace the existing trigger function to enforce one dealer per ROLE per table per time slot
-- (not just one dealer per table per slot)
CREATE OR REPLACE FUNCTION public.check_one_dealer_per_slot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only check if table_id is set (BR/break has no table)
  IF NEW.table_id IS NOT NULL THEN
    -- Check: no other dealer can have the same role on the same table in the same time slot
    IF EXISTS (
      SELECT 1 FROM public.breaklist
      WHERE casino_id = NEW.casino_id 
        AND date = NEW.date 
        AND time_slot = NEW.time_slot
        AND table_id = NEW.table_id 
        AND role = NEW.role
        AND dealer_id != NEW.dealer_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Role % on this table is already assigned to another dealer for this time slot', NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
