REVOKE ALL ON FUNCTION public.apply_chip_emission() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_chip_emission() FROM anon;
REVOKE ALL ON FUNCTION public.apply_chip_emission() FROM authenticated;

REVOKE ALL ON FUNCTION public.log_chip_conservation_mode_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_chip_conservation_mode_change() FROM anon;
REVOKE ALL ON FUNCTION public.log_chip_conservation_mode_change() FROM authenticated;