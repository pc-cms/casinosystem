ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_disabled_at ON public.profiles(disabled_at);