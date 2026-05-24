CREATE OR REPLACE FUNCTION public.prevent_transaction_modify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Seed mode bypass (used by initial seed import).
  IF current_setting('app.seed_mode', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- DELETE is always forbidden.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Transactions are immutable and cannot be modified or deleted';
  END IF;

  -- Allow ONLY a cancellation transition: cancelled_at goes NULL -> set,
  -- cancelled_by / cancel_reason may be filled, every other existing column must be unchanged.
  -- Use jsonb comparison so the trigger cannot reference columns that do not exist on this database.
  IF TG_OP = 'UPDATE'
     AND OLD.cancelled_at IS NULL
     AND NEW.cancelled_at IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['cancelled_at', 'cancelled_by', 'cancel_reason'])
         IS NOT DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['cancelled_at', 'cancelled_by', 'cancel_reason'])
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transactions are immutable and cannot be modified or deleted';
END;
$function$;