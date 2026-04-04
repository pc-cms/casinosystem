
CREATE OR REPLACE FUNCTION public.trg_set_visit_business_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.date := get_business_date_for_casino(NEW.casino_id);
  RETURN NEW;
END;
$$;
