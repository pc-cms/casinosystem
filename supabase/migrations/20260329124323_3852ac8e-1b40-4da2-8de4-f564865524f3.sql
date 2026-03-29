
CREATE TABLE public.client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  table_id uuid NOT NULL REFERENCES public.gaming_tables(id),
  avg_bet numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  total_bet numeric NOT NULL DEFAULT 0,
  hands_played integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see client sessions"
  ON public.client_sessions FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Pit managers insert client sessions"
  ON public.client_sessions FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'pit'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Pit managers update client sessions"
  ON public.client_sessions FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'pit'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.client_sessions;
