REVOKE ALL ON FUNCTION public.auto_close_forgotten_business_days() FROM anon;
REVOKE ALL ON FUNCTION public.auto_close_forgotten_business_days() FROM authenticated;
REVOKE ALL ON FUNCTION public.auto_close_forgotten_business_days() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_current_business_date(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_current_business_date(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_business_date(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.close_business_day(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.close_business_day(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(uuid, text) TO authenticated;