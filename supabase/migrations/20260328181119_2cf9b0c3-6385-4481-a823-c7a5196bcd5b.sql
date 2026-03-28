
-- Breaklist logs for tracking all breaklist changes
CREATE TABLE IF NOT EXISTS public.breaklist_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  breaklist_id UUID REFERENCES public.breaklist(id),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  action TEXT NOT NULL,
  old_role TEXT,
  new_role TEXT,
  old_table_id UUID,
  new_table_id UUID,
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_breaklist_logs_casino_date ON public.breaklist_logs(casino_id, date);

ALTER TABLE public.breaklist_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see breaklist logs" ON public.breaklist_logs FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()));

CREATE POLICY "Pit managers insert breaklist logs" ON public.breaklist_logs FOR INSERT TO authenticated
  WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND operator_id = auth.uid());

-- Prevent modification of breaklist logs
CREATE TRIGGER no_update_breaklist_logs BEFORE UPDATE ON public.breaklist_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();
CREATE TRIGGER no_delete_breaklist_logs BEFORE DELETE ON public.breaklist_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();

-- Function: when dealer shift changes to S or A, clear future breaklist cells
CREATE OR REPLACE FUNCTION public.clear_future_breaklist_on_shift()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- When shift is set to S (sick) or A (absent), clear future breaklist cells for that dealer/date
  IF NEW.shift IN ('S', 'A') THEN
    -- Delete non-locked future breaklist entries for this dealer on this date
    DELETE FROM public.breaklist
    WHERE dealer_id = NEW.dealer_id
      AND date = NEW.date
      AND NOT is_locked;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_clear_breaklist_on_shift
  AFTER INSERT OR UPDATE ON public.pit_rota
  FOR EACH ROW EXECUTE FUNCTION public.clear_future_breaklist_on_shift();
