-- FIX_ADMIN_RLS.sql — idempotent admin write auth for legacy login
-- Run once in Supabase SQL Editor (or: npm run admin:fix)

-- ── 1. Header-based admin auth (x-admin-email / x-admin-password) ───────────

create or replace function public.legacy_admin_from_headers()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.admins a
  where lower(a.email) = lower(nullif(
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-email'),
    ''
  ))
    and a.password = nullif(
      (nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-password'),
      ''
    )
    and coalesce(a.status, 'active') = 'active'
  limit 1;
$$;

-- ── 2. Session-based admin auth (x-legacy-admin-session) ────────────────────

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

-- ── 3. Unified is_admin() ───────────────────────────────────────────────────

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
        id = public.legacy_admin_from_headers()
        or id = public.legacy_admin_session_admin_id()
        or auth_user_id = auth.uid()
        or lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- ── 4. Session RPCs + verify_legacy_admin returns session_token ──────────────

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

-- ── 5. Public form inserts ──────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array['inquiries', 'admissions', 'contacts'] loop
    execute format('drop policy if exists public_insert on %I', t);
    execute format('create policy public_insert on %I for insert with check (true)', t);
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ── 6. Grants ───────────────────────────────────────────────────────────────

revoke all on function public.legacy_admin_from_headers() from public;
revoke all on function public.legacy_admin_session_admin_id() from public;
revoke all on function public.create_legacy_admin_session(text, text) from public;
revoke all on function public.validate_legacy_admin_session(text) from public;
revoke all on function public.verify_legacy_admin(text, text) from public;

grant execute on function public.legacy_admin_from_headers() to anon, authenticated, service_role;
grant execute on function public.legacy_admin_session_admin_id() to anon, authenticated, service_role;
grant execute on function public.create_legacy_admin_session(text, text) to anon, authenticated;
grant execute on function public.validate_legacy_admin_session(text) to anon, authenticated;
grant execute on function public.verify_legacy_admin(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
