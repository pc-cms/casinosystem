
-- Add id_number field to players table for passport/ID tracking
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_number text NOT NULL DEFAULT '';

-- Create storage bucket for player document scans
INSERT INTO storage.buckets (id, name, public) VALUES ('player-documents', 'player-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for player-documents bucket: authenticated users from same casino can upload/view
CREATE POLICY "Casino users upload player docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'player-documents');

CREATE POLICY "Casino users view player docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'player-documents');
