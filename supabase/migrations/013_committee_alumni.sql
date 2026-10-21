-- Committee and Alumni CMS tables
-- Run this migration in Supabase SQL Editor after the existing migrations.

create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text not null,
  photo_url text,
  qualification text,
  description text,
  published boolean not null default true,
  status text not null default 'published',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  department text not null,
  passing_year integer,
  photo_url text,
  current_designation text,
  company text,
  biography text,
  published boolean not null default true,
  status text not null default 'published',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alumni_passing_year_sane check (passing_year is null or passing_year between 1950 and 2100)
);

alter table public.committee_members enable row level security;
alter table public.alumni enable row level security;

drop policy if exists public_read_published on public.committee_members;
create policy public_read_published on public.committee_members for select using (published = true);
drop policy if exists verified_admin_manage on public.committee_members;
create policy verified_admin_manage on public.committee_members for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_published on public.alumni;
create policy public_read_published on public.alumni for select using (published = true);
drop policy if exists verified_admin_manage on public.alumni;
create policy verified_admin_manage on public.alumni for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_committee_members_updated_at on public.committee_members;
create trigger set_committee_members_updated_at before update on public.committee_members for each row execute function public.set_updated_at();
drop trigger if exists set_alumni_updated_at on public.alumni;
create trigger set_alumni_updated_at before update on public.alumni for each row execute function public.set_updated_at();

create index if not exists idx_committee_members_public_order on public.committee_members (published, display_order);
create index if not exists idx_alumni_public_order on public.alumni (published, display_order);
create index if not exists idx_alumni_public_filters on public.alumni (published, department, passing_year);

-- Existing public `cms` bucket and its admin-only storage policy are reused.
notify pgrst, 'reload schema';