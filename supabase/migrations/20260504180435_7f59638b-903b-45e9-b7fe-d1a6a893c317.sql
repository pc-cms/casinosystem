CREATE OR REPLACE FUNCTION public.validate_cage_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.transfer_type NOT IN ('add_float','collection','fill','credit','slots_out','slots_in') THEN
    RAISE EXCEPTION 'Invalid transfer_type: %', NEW.transfer_type;
  END IF;
  IF NEW.direction NOT IN ('cash_in','cash_out','chip_to_table','chip_from_table') THEN
    RAISE EXCEPTION 'Invalid direction: %', NEW.direction;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Cage transfer amount must be greater than zero';
  END IF;
  IF NEW.transfer_type IN ('fill','credit') THEN
    IF NEW.table_id IS NULL THEN
      RAISE EXCEPTION '% requires table_id', NEW.transfer_type;
    END IF;
    IF NEW.chips IS NULL OR jsonb_typeof(NEW.chips) <> 'object' THEN
      RAISE EXCEPTION '% requires chips breakdown', NEW.transfer_type;
    END IF;
  ELSE
    IF NEW.table_id IS NOT NULL THEN
      RAISE EXCEPTION '% must not have table_id', NEW.transfer_type;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shifts WHERE id = NEW.shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Cage transfer requires an open shift';
  END IF;
  RETURN NEW;
END;
$$;