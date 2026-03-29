
CREATE TABLE public.casino_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  checked_in_at timestamp with time zone NOT NULL DEFAULT now(),
  checked_in_by uuid NOT NULL,
  checked_out_at timestamp with time zone,
  UNIQUE (casino_id, player_id, date)
);

ALTER TABLE public.casino_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see visits"
  ON public.casino_visits FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Reception/pit/managers insert visits"
  ON public.casino_visits FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'reception') OR has_role(auth.uid(), 'pit') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Reception/pit/managers update visits"
  ON public.casino_visits FOR UPDATE TO authenticated
  USING (
    casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'reception') OR has_role(auth.uid(), 'pit') OR has_role(auth.uid(), 'manager'))
  );
