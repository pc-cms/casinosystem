UPDATE public.shifts
   SET closing_count = closing_count
 WHERE status = 'closed';