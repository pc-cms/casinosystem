
-- pos_player_charges: outstanding F&B amounts charged to a player's account.
CREATE TABLE public.pos_player_charges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id       uuid NOT NULL REFERENCES public.casinos(id),
  tab_id          uuid NOT NULL REFERENCES public.pos_tabs(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES public.players(id),
  business_date   date NOT NULL,
  amount_tzs      bigint NOT NULL CHECK (amount_tzs > 0),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','voided')),
  settled_at      timestamptz,
  settled_by      uuid,
  settlement_ref  text,
  void_reason     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tab_id)
);

CREATE INDEX idx_ppc_player_open  ON public.pos_player_charges(casino_id, player_id, status);
CREATE INDEX idx_ppc_casino_date  ON public.pos_player_charges(casino_id, business_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.pos_player_charges TO authenticated;
GRANT ALL ON public.pos_player_charges TO service_role;

ALTER TABLE public.pos_player_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppc_select" ON public.pos_player_charges FOR SELECT TO authenticated
USING (
  user_can_see_casino(auth.uid(), casino_id) AND (
    has_any_pos_role(auth.uid())
    OR has_role(auth.uid(),'manager'::app_role)
    OR has_role(auth.uid(),'cashier'::app_role)
    OR has_role(auth.uid(),'finance_manager'::app_role)
    OR has_role(auth.uid(),'pit'::app_role)
    OR has_role(auth.uid(),'super_admin'::app_role)
  )
);

-- Inserts are only meant to happen via the trigger (SECURITY DEFINER context). Block direct inserts from clients.
CREATE POLICY "ppc_no_direct_insert" ON public.pos_player_charges FOR INSERT TO authenticated
WITH CHECK (false);

-- Settlement / void: cashier/manager/finance/super_admin.
CREATE POLICY "ppc_update_settle" ON public.pos_player_charges FOR UPDATE TO authenticated
USING (
  user_can_see_casino(auth.uid(), casino_id) AND (
    has_role(auth.uid(),'cashier'::app_role)
    OR has_role(auth.uid(),'manager'::app_role)
    OR has_role(auth.uid(),'finance_manager'::app_role)
    OR has_role(auth.uid(),'super_admin'::app_role)
  )
);

-- updated_at trigger
CREATE TRIGGER trg_ppc_updated_at
BEFORE UPDATE ON public.pos_player_charges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When a POS tab transitions to status='closed' with a player_charge in payment_split,
-- record an outstanding charge against the player.
CREATE OR REPLACE FUNCTION public.pos_tab_emit_player_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount bigint;
  v_date   date;
BEGIN
  IF NEW.status <> 'closed' OR COALESCE(OLD.status, '') = 'closed' THEN
    RETURN NEW;
  END IF;
  IF NEW.player_id IS NULL OR NEW.payment_split IS NULL THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE((NEW.payment_split->>'player_charge')::bigint, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_date := COALESCE(NEW.business_date, get_current_business_date(NEW.casino_id));

  INSERT INTO public.pos_player_charges
    (casino_id, tab_id, player_id, business_date, amount_tzs)
  VALUES
    (NEW.casino_id, NEW.id, NEW.player_id, v_date, v_amount)
  ON CONFLICT (tab_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pos_tab_emit_player_charge
AFTER UPDATE OF status ON public.pos_tabs
FOR EACH ROW EXECUTE FUNCTION public.pos_tab_emit_player_charge();
