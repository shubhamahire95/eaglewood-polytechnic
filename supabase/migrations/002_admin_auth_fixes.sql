-- Eaglewood CMS — Admin auth & RLS fixes (run after 001)
-- Enables legacy login via RPC and CRUD for Supabase Auth users matched by email.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where coalesce(status, 'active') = 'active'
      and (
        auth_user_id = auth.uid()
        or lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Verify legacy admins table password without exposing rows to anon SELECT.
create or replace function public.verify_legacy_admin(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admins%rowtype;
begin
  if p_email is null or p_password is null or length(trim(p_email)) = 0 then
    return null;
  end if;

  select * into r
  from public.admins
  where lower(email) = lower(trim(p_email))
    and password = p_password
  limit 1;

  if not found then
    return null;
  end if;

  if coalesce(r.status, 'active') <> 'active' then
    return json_build_object('error', 'inactive');
  end if;

  return json_build_object(
    'id', r.id,
    'email', r.email,
    'name', r.name,
    'role', r.role,
    'status', r.status,
    'auth_user_id', r.auth_user_id
  );
end;
$$;

-- Detect login route without returning password hash.
create or replace function public.get_admin_login_route(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when auth_user_id is not null then 'auth'
        when password is not null and password <> '' then 'legacy'
        else 'auth'
      end
      from public.admins
      where lower(email) = lower(trim(p_email))
      limit 1
    ),
    'unknown'
  );
$$;

revoke all on function public.verify_legacy_admin(text, text) from public;
revoke all on function public.get_admin_login_route(text) from public;
grant execute on function public.verify_legacy_admin(text, text) to anon, authenticated;
grant execute on function public.get_admin_login_route(text) to anon, authenticated;

notify pgrst, 'reload schema';
