-- 1. Add new enum values 'in' and 'out' to transaction type
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'in';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'out';

-- 2. Update auto_log_transaction trigger to support new values
CREATE OR REPLACE FUNCTION public.auto_log_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.activity_logs (casino_id, category, action, operator_id, details)
  VALUES (
    NEW.casino_id,
    'transaction',
    CASE 
      WHEN NEW.type::text IN ('buy', 'in') THEN 'IN'
      WHEN NEW.type::text IN ('cashout', 'out') THEN 'OUT'
      ELSE UPPER(NEW.type::text)
    END,
    NEW.operator_id,
    jsonb_build_object(
      'transaction_id', NEW.id,
      'player_id', NEW.player_id,
      'amount', NEW.amount,
      'table_id', NEW.table_id,
      'shift_id', NEW.shift_id,
      'source', 'db_trigger'
    )
  );
  RETURN NEW;
END;
$function$;

-- 3. Create chip_color_settings table
CREATE TABLE public.chip_color_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  denomination bigint NOT NULL,
  bg_color text NOT NULL,
  text_color text NOT NULL DEFAULT '#FFFFFF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (casino_id, denomination)
);

ALTER TABLE public.chip_color_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see chip colors"
ON public.chip_color_settings
FOR SELECT
TO authenticated
USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Super admins see all chip colors"
ON public.chip_color_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers insert chip colors"
ON public.chip_color_settings
FOR INSERT
TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers update chip colors"
ON public.chip_color_settings
FOR UPDATE
TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND has_role(auth.uid(), 'manager'::app_role)
);

CREATE TRIGGER update_chip_color_settings_updated_at
BEFORE UPDATE ON public.chip_color_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_chip_color_settings_casino ON public.chip_color_settings(casino_id);