
CREATE TYPE public.staff_department AS ENUM ('security', 'cashier', 'bartender', 'hostess', 'waiter', 'cleaner', 'it', 'hr');

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  name text NOT NULL,
  department staff_department NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see staff" ON public.staff_members FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));
CREATE POLICY "Managers insert staff" ON public.staff_members FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers update staff" ON public.staff_members FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.staff_rota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id),
  date date NOT NULL,
  shift text NOT NULL DEFAULT 'D',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, staff_id, date)
);

ALTER TABLE public.staff_rota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see staff rota" ON public.staff_rota FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));
CREATE POLICY "Managers insert staff rota" ON public.staff_rota FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role)));
CREATE POLICY "Managers update staff rota" ON public.staff_rota FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role)));
CREATE POLICY "Managers delete staff rota" ON public.staff_rota FOR DELETE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role)));

CREATE TABLE public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id),
  date date NOT NULL,
  value text NOT NULL DEFAULT '',
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, staff_id, date)
);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see staff attendance" ON public.staff_attendance FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));
CREATE POLICY "Managers insert staff attendance" ON public.staff_attendance FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role)));
CREATE POLICY "Managers update staff attendance" ON public.staff_attendance FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pit'::app_role)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_rota;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance;
