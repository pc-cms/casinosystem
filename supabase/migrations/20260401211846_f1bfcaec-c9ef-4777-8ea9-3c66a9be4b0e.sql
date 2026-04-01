
-- Create player-photos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Make player-documents public
UPDATE storage.buckets SET public = true WHERE id = 'player-documents';

-- Storage policies for player-photos
CREATE POLICY "Anyone can view player photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-photos');

CREATE POLICY "Authenticated users upload player photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos');

CREATE POLICY "Authenticated users update player photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos');

-- Storage policies for player-documents  
CREATE POLICY "Anyone can view player documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-documents');

CREATE POLICY "Authenticated users upload player documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-documents');

CREATE POLICY "Authenticated users update player documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-documents');
