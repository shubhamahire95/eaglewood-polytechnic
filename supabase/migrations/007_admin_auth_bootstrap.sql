-- Link Supabase Auth users to public.admins and confirm emails (one-time bootstrap).
-- Prerequisite: create the user in Dashboard → Authentication → Users (email + password).
-- NEVER update auth.users.confirmed_at — it is generated (read-only) on Supabase 2025+.

create or replace function public.bootstrap_admin_auth_links()
returns table(
  email text,
  user_id uuid,
  admin_linked boolean,
  email_confirmed boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  email_confirmed_ts timestamptz;
begin
  for r in
    select
      a.id as admin_id,
      a.email as admin_email,
      u.id as user_id,
      u.email_confirmed_at
    from public.admins a
    inner join auth.users u on lower(u.email) = lower(a.email)
    where coalesce(a.status, 'active') = 'active'
  loop
    email_confirmed_ts := r.email_confirmed_at;

    if email_confirmed_ts is null then
      update auth.users
      set email_confirmed_at = now()
      where id = r.user_id
        and email_confirmed_at is null;

      select u.email_confirmed_at into email_confirmed_ts
      from auth.users u
      where u.id = r.user_id;
    end if;

    update public.admins
    set
      auth_user_id = r.user_id,
      updated_at = now()
    where id = r.admin_id
      and auth_user_id is distinct from r.user_id;

    email := r.admin_email;
    user_id := r.user_id;
    admin_linked := true;
    email_confirmed := email_confirmed_ts is not null;
    return next;
  end loop;
end;
$$;

revoke all on function public.bootstrap_admin_auth_links() from public;
grant execute on function public.bootstrap_admin_auth_links() to service_role;

do $bootstrap$
begin
  perform * from public.bootstrap_admin_auth_links();
exception
  when others then
    raise warning 'bootstrap_admin_auth_links skipped: %', sqlerrm;
end
$bootstrap$;

notify pgrst, 'reload schema';
