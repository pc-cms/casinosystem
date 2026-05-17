-- ─────────────────────────────────────────────────────────────
-- seed_export_auth_users(p_casino_id uuid)
-- Returns auth.users rows (incl. encrypted_password) for every
-- account that has access to this casino, so cloud-seed-export
-- can ship them to a fresh local node where the clone runs.
--
-- "Has access" means ANY of:
--   • user_casino_access row for p_casino_id
--   • profiles.casino_id = p_casino_id
--   • super_admin role (network-wide)
--
-- SECURITY DEFINER + locked search_path. Only callable by service_role
-- (seed-export edge function authenticates with x-service-key or
-- x-sync-secret + peer_links).
-- ─────────────────────────────────────────────────────────────
create or replace function public.seed_export_auth_users(p_casino_id uuid)
returns table (
  id uuid,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  aud text,
  role text,
  created_at timestamptz,
  phone text
)
language sql
stable
security definer
set search_path = public, auth
as $$
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
    select p.id from public.profiles p where p.casino_id = p_casino_id
    union
    select ur.user_id from public.user_roles ur where ur.role = 'super_admin'
  )
$$;

revoke all on function public.seed_export_auth_users(uuid) from public;
revoke all on function public.seed_export_auth_users(uuid) from authenticated;
revoke all on function public.seed_export_auth_users(uuid) from anon;
grant execute on function public.seed_export_auth_users(uuid) to service_role;