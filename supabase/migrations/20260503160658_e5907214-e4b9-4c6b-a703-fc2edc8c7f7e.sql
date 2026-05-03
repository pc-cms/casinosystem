-- 1) Realtime for chip color settings
ALTER TABLE public.chip_color_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chip_color_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chip_color_settings';
  END IF;
END $$;

-- 2) Atomic update of a user's role set (manager scoped to own casino, super_admin global)
CREATE OR REPLACE FUNCTION public.update_user_roles(_user_id uuid, _roles app_role[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_casino uuid;
  target_casino uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'manager'::app_role)
       OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: manager or super_admin role required';
  END IF;

  -- Manager scoping: cannot edit users of other casinos
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    SELECT casino_id INTO caller_casino FROM public.profiles WHERE user_id = auth.uid();
    SELECT casino_id INTO target_casino FROM public.profiles WHERE user_id = _user_id;
    IF caller_casino IS NULL OR target_casino IS NULL OR caller_casino <> target_casino THEN
      RAISE EXCEPTION 'forbidden: cross-casino role edits are not allowed';
    END IF;
  END IF;

  -- Remove roles no longer present
  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role <> ALL(_roles);

  -- Insert new roles (idempotent)
  INSERT INTO public.user_roles(user_id, role)
  SELECT _user_id, r
  FROM unnest(_roles) AS r
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_roles(uuid, app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_roles(uuid, app_role[]) TO authenticated;