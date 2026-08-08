-- Downloads CMS table (student resources: admission forms, circulars, prospectus)
-- Idempotent — safe to run on production after migrations 001–010.

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text not null,
  file_type text default 'pdf',
  category text default 'circulars',
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Repair columns if table existed without full schema (no data loss).
alter table public.downloads add column if not exists title text;
alter table public.downloads add column if not exists description text;
alter table public.downloads add column if not exists file_url text;
alter table public.downloads add column if not exists file_type text default 'pdf';
alter table public.downloads add column if not exists category text default 'circulars';
alter table public.downloads add column if not exists published boolean default true;
alter table public.downloads add column if not exists status text default 'published';
alter table public.downloads add column if not exists display_order int default 0;
alter table public.downloads add column if not exists created_at timestamptz default now();
alter table public.downloads add column if not exists updated_at timestamptz default now();

alter table public.downloads enable row level security;

drop policy if exists public_read_published on public.downloads;
create policy public_read_published on public.downloads
  for select using (published = true);

drop policy if exists verified_admin_manage on public.downloads;
create policy verified_admin_manage on public.downloads
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_downloads_updated_at on public.downloads;
create trigger set_downloads_updated_at
  before update on public.downloads
  for each row execute function public.set_updated_at();

create index if not exists idx_downloads_published_order on public.downloads (published, display_order);

notify pgrst, 'reload schema';
