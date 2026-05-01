CREATE OR REPLACE FUNCTION public.apply_chip_emission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chip_initial_baseline (casino_id, denomination, initial_quantity, created_by)
  VALUES (NEW.casino_id, NEW.denomination, NEW.quantity_added, NEW.operator_id)
  ON CONFLICT (casino_id, denomination)
  DO UPDATE SET
    initial_quantity = public.chip_initial_baseline.initial_quantity + EXCLUDED.initial_quantity,
    updated_at = now();

  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id,
    'system'::public.log_category,
    'CHIP_EMISSION',
    NEW.operator_id,
    jsonb_build_object(
      'denomination', NEW.denomination,
      'quantity_added', NEW.quantity_added,
      'reason', NEW.reason,
      'emission_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_chip_conservation_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.chip_conservation_mode IS DISTINCT FROM NEW.chip_conservation_mode THEN
    INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
    VALUES (
      NEW.id,
      'system'::public.log_category,
      'CHIP_CONSERVATION_MODE_CHANGE',
      auth.uid(),
      jsonb_build_object(
        'old_mode', OLD.chip_conservation_mode,
        'new_mode', NEW.chip_conservation_mode
      )
    );
  END IF;

  RETURN NEW;
END;
$$;