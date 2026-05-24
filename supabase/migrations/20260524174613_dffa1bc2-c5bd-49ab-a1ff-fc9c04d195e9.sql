-- Allow cancellation-only UPDATE on transactions; keep all other fields immutable.
-- Cancellation sets cancelled_at, cancelled_by, cancel_reason from NULL.
-- DELETEs remain blocked. Seed mode bypass preserved.
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
  -- cancelled_by / cancel_reason may be filled, every other column must be unchanged.
  IF TG_OP = 'UPDATE'
     AND OLD.cancelled_at IS NULL
     AND NEW.cancelled_at IS NOT NULL
     AND NEW.id              IS NOT DISTINCT FROM OLD.id
     AND NEW.casino_id       IS NOT DISTINCT FROM OLD.casino_id
     AND NEW.player_id       IS NOT DISTINCT FROM OLD.player_id
     AND NEW.table_id        IS NOT DISTINCT FROM OLD.table_id
     AND NEW.shift_id        IS NOT DISTINCT FROM OLD.shift_id
     AND NEW.type            IS NOT DISTINCT FROM OLD.type
     AND NEW.amount          IS NOT DISTINCT FROM OLD.amount
     AND NEW.currency        IS NOT DISTINCT FROM OLD.currency
     AND NEW.foreign_amount  IS NOT DISTINCT FROM OLD.foreign_amount
     AND NEW.exchange_rate   IS NOT DISTINCT FROM OLD.exchange_rate
     AND NEW.chips           IS NOT DISTINCT FROM OLD.chips
     AND NEW.operator_id     IS NOT DISTINCT FROM OLD.operator_id
     AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transactions are immutable and cannot be modified or deleted';
END;
$function$;