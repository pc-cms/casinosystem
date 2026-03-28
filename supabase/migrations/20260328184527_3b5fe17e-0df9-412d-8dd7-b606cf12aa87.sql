
-- Add poker dealer roles to the enum
ALTER TYPE public.dealer_role ADD VALUE IF NOT EXISTS 'P';
ALTER TYPE public.dealer_role ADD VALUE IF NOT EXISTS 'Pi';
ALTER TYPE public.dealer_role ADD VALUE IF NOT EXISTS 'AR';
ALTER TYPE public.dealer_role ADD VALUE IF NOT EXISTS 'ARi';
ALTER TYPE public.dealer_role ADD VALUE IF NOT EXISTS 'ARc';
