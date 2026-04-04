
-- 1. user_casino_access table
CREATE TABLE public.user_casino_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, casino_id)
);

ALTER TABLE public.user_casino_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins see all casino access"
  ON public.user_casino_access FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "FM sees all casino access"
  ON public.user_casino_access FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager'));

CREATE POLICY "Managers see own casino access"
  ON public.user_casino_access FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Users see own access"
  ON public.user_casino_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins manage casino access insert"
  ON public.user_casino_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_manager'));

CREATE POLICY "Super admins manage casino access delete"
  ON public.user_casino_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_manager'));

-- 2. inter_casino_transfers table
CREATE TABLE public.inter_casino_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_casino_id uuid NOT NULL REFERENCES public.casinos(id),
  to_casino_id uuid NOT NULL REFERENCES public.casinos(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'pending',
  description text NOT NULL DEFAULT '',
  initiated_by uuid NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inter_casino_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins see all transfers"
  ON public.inter_casino_transfers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_manager'));

CREATE POLICY "Managers see own casino transfers"
  ON public.inter_casino_transfers FOR SELECT TO authenticated
  USING (
    from_casino_id = get_user_casino_id(auth.uid()) OR 
    to_casino_id = get_user_casino_id(auth.uid())
  );

CREATE POLICY "Managers create transfers"
  ON public.inter_casino_transfers FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = auth.uid() AND
    (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Managers update transfers"
  ON public.inter_casino_transfers FOR UPDATE TO authenticated
  USING (
    (to_casino_id = get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager')) OR
    public.has_role(auth.uid(), 'finance_manager') OR
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_inter_casino_transfers_updated_at
  BEFORE UPDATE ON public.inter_casino_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. local_servers table
CREATE TABLE public.local_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE UNIQUE,
  server_ip text NOT NULL,
  server_name text NOT NULL DEFAULT '',
  is_online boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NOT NULL,
  sync_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);

ALTER TABLE public.local_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage local servers"
  ON public.local_servers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "FM sees local servers"
  ON public.local_servers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager'));

-- 4. Validation trigger for inter_casino_transfers
CREATE OR REPLACE FUNCTION public.validate_inter_casino_transfer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;
  IF NEW.from_casino_id = NEW.to_casino_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same casino';
  END IF;
  IF NEW.status NOT IN ('pending', 'confirmed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transfer status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_inter_casino_transfer_trg
  BEFORE INSERT OR UPDATE ON public.inter_casino_transfers
  FOR EACH ROW EXECUTE FUNCTION validate_inter_casino_transfer();

-- 5. Helper function
CREATE OR REPLACE FUNCTION public.user_has_casino_access(_user_id uuid, _casino_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'finance_manager')
    UNION ALL
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND casino_id = _casino_id
    UNION ALL
    SELECT 1 FROM public.user_casino_access WHERE user_id = _user_id AND casino_id = _casino_id
  );
$$;
