
-- Move sensitive fields (pin_hash, rfid_tag) to a separate table accessible only by the owner
CREATE TABLE IF NOT EXISTS public.user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pin_hash text,
  rfid_tag text UNIQUE
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- Only the user themselves can read their own credentials
CREATE POLICY "Users read own credentials"
ON public.user_credentials FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Only the user themselves can update their own credentials
CREATE POLICY "Users update own credentials"
ON public.user_credentials FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Managers can insert credentials (for user creation flow)
CREATE POLICY "Managers insert credentials"
ON public.user_credentials FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Migrate existing data
INSERT INTO public.user_credentials (user_id, pin_hash, rfid_tag)
SELECT user_id, pin_hash, rfid_tag FROM public.profiles
WHERE pin_hash IS NOT NULL OR rfid_tag IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create a security definer function for RFID lookup (used by manager override)
CREATE OR REPLACE FUNCTION public.lookup_rfid_user(rfid text)
RETURNS TABLE(user_id uuid, display_name text, casino_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uc.user_id, p.display_name, p.casino_id
  FROM public.user_credentials uc
  JOIN public.profiles p ON p.user_id = uc.user_id
  WHERE uc.rfid_tag = rfid
  LIMIT 1;
$$;

-- Remove sensitive columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS rfid_tag
