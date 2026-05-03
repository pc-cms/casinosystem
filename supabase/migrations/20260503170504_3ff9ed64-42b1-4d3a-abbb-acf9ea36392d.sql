-- Auto-grant: when a user gets the surveillance role, open access to all casinos
CREATE OR REPLACE FUNCTION public.grant_surveillance_access_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'surveillance'::app_role THEN
    INSERT INTO public.user_casino_access (user_id, casino_id, granted_by)
    SELECT NEW.user_id, c.id,
           COALESCE(auth.uid(), (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'::app_role LIMIT 1))
    FROM public.casinos c
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_surveillance_access ON public.user_roles;
CREATE TRIGGER trg_grant_surveillance_access
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.grant_surveillance_access_on_role();

-- Auto-grant: when a new casino is created, give access to every surveillance user
CREATE OR REPLACE FUNCTION public.grant_surveillance_access_on_casino()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_casino_access (user_id, casino_id, granted_by)
  SELECT ur.user_id, NEW.id,
         COALESCE(auth.uid(), (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'::app_role LIMIT 1))
  FROM public.user_roles ur
  WHERE ur.role = 'surveillance'::app_role
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_surveillance_on_new_casino ON public.casinos;
CREATE TRIGGER trg_grant_surveillance_on_new_casino
AFTER INSERT ON public.casinos
FOR EACH ROW EXECUTE FUNCTION public.grant_surveillance_access_on_casino();