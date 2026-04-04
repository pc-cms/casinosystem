
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TABLE public.casinos ADD COLUMN IF NOT EXISTS slug text UNIQUE;
