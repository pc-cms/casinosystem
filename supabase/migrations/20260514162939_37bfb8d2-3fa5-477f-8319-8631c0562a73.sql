-- Clean up erroneously auto-filled attendance for the still-open business day 2026-05-14 (Arusha).
-- The day was NOT closed in business_day_closures, so these 9-hour rows should not exist.
DELETE FROM public.dealer_attendance
WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113'
  AND date = '2026-05-14'
  AND value = '9'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_day_closures c
    WHERE c.casino_id = public.dealer_attendance.casino_id
      AND c.business_date = public.dealer_attendance.date
  );

DELETE FROM public.staff_attendance
WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113'
  AND date = '2026-05-14'
  AND value = '9'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_day_closures c
    WHERE c.casino_id = public.staff_attendance.casino_id
      AND c.business_date = public.staff_attendance.date
  );