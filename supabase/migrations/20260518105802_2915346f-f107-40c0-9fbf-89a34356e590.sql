CREATE OR REPLACE FUNCTION public.seed_export_auth_users(p_casino_id uuid)
 RETURNS TABLE(id uuid, email text, encrypted_password text, email_confirmed_at timestamp with time zone, raw_user_meta_data jsonb, raw_app_meta_data jsonb, aud text, role text, created_at timestamp with time zone, phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    u.id,
    u.email::text,
    u.encrypted_password::text,
    u.email_confirmed_at,
    u.raw_user_meta_data,
    u.raw_app_meta_data,
    u.aud::text,
    u.role::text,
    u.created_at,
    u.phone::text
  from auth.users u
  where u.id in (
    select uca.user_id from public.user_casino_access uca where uca.casino_id = p_casino_id
    union
    select p.user_id from public.profiles p where p.casino_id = p_casino_id and p.user_id is not null
    union
    select ur.user_id from public.user_roles ur where ur.role = 'super_admin'
  )
$function$;