-- Modify prevent_transaction_modify to check seed_mode setting
CREATE OR REPLACE FUNCTION public.prevent_transaction_modify()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow bypass in seed mode
  IF current_setting('app.seed_mode', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Transactions are immutable and cannot be modified or deleted';
END;
$function$;