
-- Change hours to value text to support both numeric hours and A/S statuses
ALTER TABLE public.dealer_attendance DROP COLUMN hours;
ALTER TABLE public.dealer_attendance ADD COLUMN value text NOT NULL DEFAULT '';
