REVOKE ALL ON FUNCTION public.enforce_employee_same_casino() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_breaklist_same_casino() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_employee_same_casino() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_breaklist_same_casino() FROM anon, authenticated;