-- One-click admin auth + storage fix for production.
-- Supabase Dashboard → SQL Editor → paste this entire file → Run
-- Then verify: npm run verify:production-api

-- (Same as supabase/migrations/010_admin_auth_storage_fix.sql)

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_admin_sessions_expires on public.admin_sessions (expires_at);
create index if not exists idx_admin_sessions_admin on public.admin_sessions (admin_id);

alter table public.admin_sessions enable row level security;
drop policy if exists admin_sessions_service on public.admin_sessions;

create or replace function public.legacy_admin_session_admin_id()
returns uuid language sql stable security definer set search_path = public as $$
  select s.admin_id from public.admin_sessions s
  where s.id = nullif((nullif(current_setting('request.headers', true), '')::json ->> 'x-legacy-admin-session'), '')::uuid
    and s.expires_at > now() limit 1;
$$;

create or replace function public.legacy_admin_from_headers()
returns uuid language sql stable security definer set search_path = public as $$
  select a.id from public.admins a
  where lower(a.email) = lower(nullif((nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-email'), ''))
    and a.password = nullif((nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-password'), '')
    and coalesce(a.status, 'active') = 'active' limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where coalesce(status, 'active') = 'active'
      and (id = public.legacy_admin_from_headers()
        or id = public.legacy_admin_session_admin_id()
        or auth_user_id = auth.uid()
        or lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function public.legacy_admin_from_headers() from public;
revoke all on function public.legacy_admin_session_admin_id() from public;
grant execute on function public.legacy_admin_from_headers() to anon, authenticated, service_role;
grant execute on function public.legacy_admin_session_admin_id() to anon, authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['settings','home_slides','updates','notices','principal_message','courses','departments','faculty','facilities','placements','gallery','media_library','footer_blocks','ai_knowledge_base','ai_prompts','ai_conversations'] loop
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['inquiries', 'admissions', 'contacts'] loop
    execute format('drop policy if exists public_insert on %I', t);
    execute format('create policy public_insert on %I for insert with check (true)', t);
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms', 'cms', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cms_public_read on storage.objects;
drop policy if exists cms_admin_upload on storage.objects;
drop policy if exists cms_admin_insert on storage.objects;
drop policy if exists cms_admin_update on storage.objects;
drop policy if exists cms_admin_delete on storage.objects;

create policy cms_public_read on storage.objects for select using (bucket_id = 'cms');
create policy cms_admin_insert on storage.objects for insert with check (bucket_id = 'cms' and public.is_admin());
create policy cms_admin_update on storage.objects for update using (bucket_id = 'cms' and public.is_admin()) with check (bucket_id = 'cms' and public.is_admin());
create policy cms_admin_delete on storage.objects for delete using (bucket_id = 'cms' and public.is_admin());

create or replace function public.verify_legacy_admin(p_email text, p_password text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.admins%rowtype; sid uuid;
begin
  if p_email is null or p_password is null or length(trim(p_email)) = 0 then return null; end if;
  select * into r from public.admins where lower(email) = lower(trim(p_email)) and password = p_password limit 1;
  if not found then return null; end if;
  if coalesce(r.status, 'active') <> 'active' then return json_build_object('error', 'inactive'); end if;
  delete from public.admin_sessions where admin_id = r.id;
  sid := gen_random_uuid();
  insert into public.admin_sessions (id, admin_id, expires_at) values (sid, r.id, now() + interval '12 hours');
  return json_build_object('id', r.id, 'email', r.email, 'name', r.name, 'role', r.role, 'status', r.status, 'auth_user_id', r.auth_user_id, 'session_token', sid::text, 'expires_at', (now() + interval '12 hours')::text);
end; $$;

revoke all on function public.verify_legacy_admin(text, text) from public;
grant execute on function public.verify_legacy_admin(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
