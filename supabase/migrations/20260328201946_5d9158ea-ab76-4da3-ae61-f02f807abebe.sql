
-- 1. ATTACH REMAINING TRIGGERS

CREATE TRIGGER check_max_tags_trigger
  BEFORE INSERT ON public.player_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.check_max_tags();

CREATE TRIGGER check_tag_conflicts_trigger
  BEFORE INSERT ON public.player_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.check_tag_conflicts();

CREATE TRIGGER check_one_dealer_per_slot_trigger
  BEFORE INSERT OR UPDATE ON public.breaklist
  FOR EACH ROW
  EXECUTE FUNCTION public.check_one_dealer_per_slot();

CREATE TRIGGER clear_future_breaklist_on_shift_trigger
  AFTER INSERT OR UPDATE ON public.pit_rota
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_future_breaklist_on_shift();

CREATE TRIGGER prevent_transaction_modify_trigger
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_transaction_modify();

-- 2. ENABLE REALTIME

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.breaklist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gaming_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_tracker;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pit_rota;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- 3. ADD CLOSING COLUMNS TO GAMING_TABLES

ALTER TABLE public.gaming_tables
  ADD COLUMN IF NOT EXISTS closing_chips jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closing_result numeric DEFAULT NULL;

-- 4. RLS FIX: Allow pit and cashier to update gaming_tables

DROP POLICY IF EXISTS "Managers update tables" ON public.gaming_tables;

CREATE POLICY "Authorized users update tables"
  ON public.gaming_tables
  FOR UPDATE
  TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
    )
  );

-- 5. TRANSACTION VALIDATION: Require shift_id

CREATE OR REPLACE FUNCTION public.validate_transaction_shift()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.shift_id IS NULL THEN
    SELECT id INTO NEW.shift_id
    FROM public.shifts
    WHERE casino_id = NEW.casino_id AND status = 'open'
    LIMIT 1;
    
    IF NEW.shift_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create transaction without an active shift';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_transaction_shift_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_shift();
