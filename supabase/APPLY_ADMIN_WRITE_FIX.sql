-- =============================================================================
-- ADMIN WRITE FIX (idempotent, Supabase Auth 2025+ compatible)
-- Safe to run multiple times. Re-run after any partial failure.
--
-- Auth schema (GoTrue latest):
--   NEVER write: auth.users.confirmed_at  (generated / read-only, error 428C9)
--   Writable:    email_confirmed_at, raw_user_meta_data, raw_app_meta_data
-- =============================================================================

-- ── 1. Legacy admin sessions (migration 006) ─────────────────────────────────

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_admin_sessions_expires on public.admin_sessions (expires_at);
create index if not exists idx_admin_sessions_admin on public.admin_sessions (admin_id);

alter table public.admin_sessions enable row level security;

create or replace function public.legacy_admin_session_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.admin_id
  from public.admin_sessions s
  where s.id = nullif(
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-legacy-admin-session'),
    ''
  )::uuid
    and s.expires_at > now()
  limit 1;
$$;

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
        id = public.legacy_admin_session_admin_id()
        or auth_user_id = auth.uid()
        or lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.create_legacy_admin_session(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admins%rowtype;
  sid uuid;
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

  delete from public.admin_sessions where admin_id = r.id;

  sid := gen_random_uuid();
  insert into public.admin_sessions (id, admin_id, expires_at)
  values (sid, r.id, now() + interval '12 hours');

  return json_build_object(
    'session_token', sid::text,
    'expires_at', (now() + interval '12 hours')::text,
    'admin', json_build_object(
      'id', r.id,
      'email', r.email,
      'name', r.name,
      'role', r.role,
      'status', r.status,
      'auth_user_id', r.auth_user_id
    )
  );
end;
$$;

create or replace function public.validate_legacy_admin_session(p_session_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admins%rowtype;
begin
  if p_session_token is null or length(trim(p_session_token)) = 0 then
    return null;
  end if;

  select a.* into r
  from public.admin_sessions s
  join public.admins a on a.id = s.admin_id
  where s.id = p_session_token::uuid
    and s.expires_at > now()
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

create or replace function public.revoke_legacy_admin_session(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_token is null or length(trim(p_session_token)) = 0 then
    return false;
  end if;

  delete from public.admin_sessions
  where id = p_session_token::uuid;

  return found;
end;
$$;

create or replace function public.destroy_legacy_admin_session(p_session_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.revoke_legacy_admin_session(p_session_token);
$$;

drop view if exists public.legacy_admin_sessions;
create view public.legacy_admin_sessions as
  select id, admin_id, expires_at, created_at
  from public.admin_sessions;

-- ── 2. verify_legacy_admin issues a write session token ──────────────────────

create or replace function public.verify_legacy_admin(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admins%rowtype;
  sid uuid;
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

  delete from public.admin_sessions where admin_id = r.id;
  sid := gen_random_uuid();
  insert into public.admin_sessions (id, admin_id, expires_at)
  values (sid, r.id, now() + interval '12 hours');

  return json_build_object(
    'id', r.id,
    'email', r.email,
    'name', r.name,
    'role', r.role,
    'status', r.status,
    'auth_user_id', r.auth_user_id,
    'session_token', sid::text,
    'expires_at', (now() + interval '12 hours')::text
  );
end;
$$;

-- ── 3. Link admins ↔ auth.users (never touch generated columns) ───────────────

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
      -- confirmed_at is GENERATED — set email_confirmed_at only.
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

-- ── 4. Grants (idempotent) ───────────────────────────────────────────────────

revoke all on function public.create_legacy_admin_session(text, text) from public;
revoke all on function public.revoke_legacy_admin_session(text) from public;
revoke all on function public.destroy_legacy_admin_session(text) from public;
revoke all on function public.validate_legacy_admin_session(text) from public;
revoke all on function public.legacy_admin_session_admin_id() from public;
revoke all on function public.verify_legacy_admin(text, text) from public;
revoke all on function public.bootstrap_admin_auth_links() from public;

grant execute on function public.create_legacy_admin_session(text, text) to anon, authenticated;
grant execute on function public.revoke_legacy_admin_session(text) to anon, authenticated;
grant execute on function public.destroy_legacy_admin_session(text) to anon, authenticated;
grant execute on function public.validate_legacy_admin_session(text) to anon, authenticated;
grant execute on function public.verify_legacy_admin(text, text) to anon, authenticated;
grant execute on function public.bootstrap_admin_auth_links() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ── 5. Auth bootstrap (isolated — must not roll back migration 006) ────────────

do $bootstrap$
begin
  perform * from public.bootstrap_admin_auth_links();
exception
  when others then
    raise warning 'bootstrap_admin_auth_links skipped: % (legacy write sessions are still active)', sqlerrm;
end
$bootstrap$;

notify pgrst, 'reload schema';

-- ── 6. Post-apply verification (read-only) ───────────────────────────────────

select 'admin_sessions' as check_name, count(*)::text as value
from public.admin_sessions
union all
select 'legacy_session_rpcs', case
  when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_legacy_admin_session'
  ) then 'ok' else 'missing'
end
union all
select 'verify_returns_token', case
  when (
    select (public.verify_legacy_admin('__none__', '__none__') is null)
  ) then 'callable' else 'error'
end
union all
select 'admins_linked', count(*)::text
from public.admins
where auth_user_id is not null;
