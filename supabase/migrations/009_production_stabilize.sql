-- Production stabilization: header-based admin auth + public form inserts + CMS seed
-- Idempotent — safe to run multiple times.

-- ── 1. Admin write via request headers (no session RPC required) ─────────────

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
        or auth_user_id = auth.uid()
        or lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- ── 2. Public form submissions (admission, contact, inquiry) ─────────────────

do $$ declare t text; begin
  foreach t in array array['inquiries', 'admissions', 'contacts'] loop
    execute format('drop policy if exists public_insert on %I', t);
    execute format('create policy public_insert on %I for insert with check (true)', t);
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke all on function public.legacy_admin_from_headers() from public;
grant execute on function public.legacy_admin_from_headers() to anon, authenticated, service_role;

-- ── 3. CMS storage bucket ─────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms', 'cms', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = excluded.public;

drop policy if exists cms_public_read on storage.objects;
create policy cms_public_read on storage.objects for select using (bucket_id = 'cms');

drop policy if exists cms_admin_upload on storage.objects;
create policy cms_admin_upload on storage.objects
  for all using (bucket_id = 'cms' and public.is_admin())
  with check (bucket_id = 'cms' and public.is_admin());

notify pgrst, 'reload schema';
