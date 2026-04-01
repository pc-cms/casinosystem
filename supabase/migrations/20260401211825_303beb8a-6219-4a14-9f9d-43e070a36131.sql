
-- Player notes table
CREATE TABLE public.player_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;

-- Casino users can read notes for their casino's players
CREATE POLICY "Casino users see player notes"
  ON public.player_notes FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

-- Authenticated users can create notes for their casino's players
CREATE POLICY "Users create player notes"
  ON public.player_notes FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND created_by = auth.uid());

-- Add id_document_url column to players table for ID document photo
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_url TEXT DEFAULT NULL;
