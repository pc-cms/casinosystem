
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS onboarding_date date;
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS onboarding_date date;

-- Add pit_boss to dealer_category enum
ALTER TYPE public.dealer_category ADD VALUE IF NOT EXISTS 'pit_boss';
