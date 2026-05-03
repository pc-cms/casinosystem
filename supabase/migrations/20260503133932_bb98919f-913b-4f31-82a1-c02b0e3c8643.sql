DELETE FROM public.dealer_attendance
WHERE date = '2026-05-03'
  AND value = '9'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_day_closures c
    WHERE c.casino_id = dealer_attendance.casino_id
      AND c.business_date = '2026-05-03'
  );