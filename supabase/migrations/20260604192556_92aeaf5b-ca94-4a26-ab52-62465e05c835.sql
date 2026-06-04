ALTER TYPE public.player_verification_status ADD VALUE IF NOT EXISTS 'unverified';
ALTER TYPE public.kyc_review_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.kyc_review_source ADD VALUE IF NOT EXISTS 'club_app';