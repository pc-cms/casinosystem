-- Add chip conservation mode toggle per casino
-- 'strict' = new casino, hard invariant enforced
-- 'observation' = legacy casino rollout, anomalies only logged/reported, no hard block
ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS chip_conservation_mode text NOT NULL DEFAULT 'strict';

-- Validate allowed values via trigger (not CHECK, per project convention)
CREATE OR REPLACE FUNCTION public.validate_chip_conservation_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chip_conservation_mode NOT IN ('strict', 'observation') THEN
    RAISE EXCEPTION 'Invalid chip_conservation_mode: %. Must be strict or observation', NEW.chip_conservation_mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_chip_conservation_mode ON public.casinos;
CREATE TRIGGER trg_validate_chip_conservation_mode
BEFORE INSERT OR UPDATE OF chip_conservation_mode ON public.casinos
FOR EACH ROW EXECUTE FUNCTION public.validate_chip_conservation_mode();

-- Audit any change to mode
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
      'chip_emission',
      'MODE_CHANGE',
      COALESCE(auth.uid(), NEW.id),
      jsonb_build_object(
        'old_mode', OLD.chip_conservation_mode,
        'new_mode', NEW.chip_conservation_mode
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_chip_conservation_mode_change ON public.casinos;
CREATE TRIGGER trg_log_chip_conservation_mode_change
AFTER UPDATE OF chip_conservation_mode ON public.casinos
FOR EACH ROW EXECUTE FUNCTION public.log_chip_conservation_mode_change();