-- Cash Desk Tips for slots shifts.
-- Auditable per-entry tips collected at the cash desk.
-- Shown separately in the printed report; NEVER included in shift balance / CDR.
CREATE TABLE public.cage_slots_tips_cd (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id uuid NOT NULL,
  cage_slots_shift_id uuid NOT NULL REFERENCES public.cage_slots_shifts(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  operator_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cage_slots_tips_cd_shift ON public.cage_slots_tips_cd(cage_slots_shift_id);
CREATE INDEX idx_cage_slots_tips_cd_casino_date ON public.cage_slots_tips_cd(casino_id, created_at DESC);

GRANT SELECT, INSERT ON public.cage_slots_tips_cd TO authenticated;
GRANT ALL ON public.cage_slots_tips_cd TO service_role;

ALTER TABLE public.cage_slots_tips_cd ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_tips_cd_select_same_casino" ON public.cage_slots_tips_cd
  FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()));

CREATE POLICY "slots_tips_cd_insert_same_casino" ON public.cage_slots_tips_cd
  FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = public.get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
  );

-- Sync (mirror to peers like other slots tables)
ALTER PUBLICATION supabase_realtime ADD TABLE public.cage_slots_tips_cd;