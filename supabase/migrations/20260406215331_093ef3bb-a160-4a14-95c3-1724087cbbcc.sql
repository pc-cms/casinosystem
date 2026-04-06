
-- Rename app_role enum value 'security' to 'surveillance'
ALTER TYPE public.app_role RENAME VALUE 'security' TO 'surveillance';

-- Add photo_url column to dealers and staff_members
ALTER TABLE public.dealers ADD COLUMN photo_url text;
ALTER TABLE public.staff_members ADD COLUMN photo_url text;

-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true);

-- Storage RLS: authenticated users can upload employee photos
CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Anyone can view employee photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-photos');
