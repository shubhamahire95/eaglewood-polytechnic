-- Eaglewood Polytechnic — CMS migration (idempotent)
-- Run once in Supabase Dashboard → SQL Editor
-- Then set cms.enabled = true in assets/js/config.js

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where auth_user_id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and coalesce(role, 'admin') in ('admin', 'super_admin')
  );
$$;

-- ── Core tables ─────────────────────────────────────────────────────────────

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name text,
  email text unique not null,
  password text,
  role text default 'admin',
  permissions jsonb default '{}'::jsonb,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  published boolean default true,
  status text default 'active',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.home_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  button_primary_label text default 'Admission Open',
  button_primary_url text default 'admission.html',
  button_secondary_label text default 'Explore Courses',
  button_secondary_url text default 'courses.html',
  floating_cards jsonb default '[]'::jsonb,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  icon text,
  title text not null,
  description text,
  image_url text,
  category text,
  pinned boolean default false,
  button_label text,
  button_url text,
  color text default '#005b5b',
  date date default current_date,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  pdf_url text,
  attachment_url text,
  image_url text,
  date date default current_date,
  expiry_date date,
  priority text default 'normal',
  important boolean default false,
  is_new boolean default true,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.principal_message (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  name text,
  designation text,
  message text,
  signature text,
  background_url text,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  department text,
  image_url text,
  title text not null,
  duration text,
  fees text,
  seats int,
  code text,
  description text,
  eligibility text,
  syllabus_pdf_url text,
  button_label text default 'View Course',
  button_url text default 'courses.html',
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hod_name text,
  hod_photo_url text,
  department_image_url text,
  description text,
  labs text,
  faculty_count int default 0,
  students_count int default 0,
  button_label text default 'Explore Department',
  button_url text default 'departments.html',
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.faculty (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  name text not null,
  qualification text,
  experience text,
  department text,
  subjects text,
  email text,
  social_links jsonb default '{}'::jsonb,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text,
  image_url text,
  description text,
  category text,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  title text default 'Placement Highlights',
  recruiter text,
  company_logo_url text,
  image_url text,
  package text,
  highest_package text,
  average_package text,
  placed_students int default 0,
  training_activities text,
  testimonial text,
  student_name text,
  course text,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  album text,
  category text,
  image_url text not null,
  alt text,
  description text,
  featured boolean default false,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  thumbnail_url text,
  title text,
  file_type text,
  folder text,
  alt text,
  tags text,
  size_bytes bigint default 0,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.footer_blocks (
  id uuid primary key default gen_random_uuid(),
  block_key text unique not null,
  title text,
  content jsonb default '{}'::jsonb,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  course text,
  message text,
  assigned_to text,
  reply_status text default 'pending',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  phone text not null,
  email text,
  course text,
  previous_school text,
  address text,
  message text,
  application_status text default 'new',
  payment_status text default 'pending',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  subject text,
  message text,
  assigned_to text,
  reply_status text default 'pending',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  category text,
  keywords text,
  version int default 1,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text,
  greeting_message text,
  fallback_response text,
  quick_replies jsonb default '[]'::jsonb,
  suggested_questions jsonb default '[]'::jsonb,
  temperature numeric default 0.7,
  token_limit int default 800,
  response_delay int default 0,
  published boolean default true,
  status text default 'published',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  visitor_name text,
  question text,
  answer text,
  rating int,
  status text default 'new',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.home_slides enable row level security;
alter table public.updates enable row level security;
alter table public.notices enable row level security;
alter table public.principal_message enable row level security;
alter table public.courses enable row level security;
alter table public.departments enable row level security;
alter table public.faculty enable row level security;
alter table public.facilities enable row level security;
alter table public.placements enable row level security;
alter table public.gallery enable row level security;
alter table public.media_library enable row level security;
alter table public.footer_blocks enable row level security;
alter table public.inquiries enable row level security;
alter table public.admissions enable row level security;
alter table public.contacts enable row level security;
alter table public.ai_knowledge_base enable row level security;
alter table public.ai_prompts enable row level security;
alter table public.ai_conversations enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'settings','home_slides','updates','notices','principal_message',
    'courses','departments','faculty','facilities','placements','gallery',
    'media_library','footer_blocks','ai_knowledge_base','ai_prompts'
  ] loop
    execute format('drop policy if exists public_read_published on %I', t);
    execute format('create policy public_read_published on %I for select using (published = true)', t);
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  foreach t in array array['inquiries','admissions','contacts','ai_conversations'] loop
    execute format('drop policy if exists public_insert on %I', t);
    execute format('create policy public_insert on %I for insert with check (true)', t);
    execute format('drop policy if exists verified_admin_manage on %I', t);
    execute format('create policy verified_admin_manage on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists admin_self_or_admin_read on public.admins;
create policy admin_self_or_admin_read on public.admins
  for select using (
    auth_user_id = auth.uid()
    or lower(email) = lower(auth.jwt() ->> 'email')
    or public.is_admin()
  );
drop policy if exists verified_admin_manage on public.admins;
create policy verified_admin_manage on public.admins
  for all using (public.is_admin()) with check (public.is_admin());

-- ── updated_at triggers ───────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array[
    'admins','settings','home_slides','updates','notices','principal_message',
    'courses','departments','faculty','facilities','placements','gallery',
    'media_library','footer_blocks','inquiries','admissions','contacts',
    'ai_knowledge_base','ai_prompts','ai_conversations'
  ] loop
    execute format('drop trigger if exists set_%s_updated_at on %I', t, t);
    execute format('create trigger set_%s_updated_at before update on %I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ── Seed settings ───────────────────────────────────────────────────────────

insert into public.settings (key, value, display_order) values
  ('phone', '"+91 94237 16230"', 1),
  ('email', '"eaglewoodpoly@gmail.com"', 2),
  ('address', '"Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131"', 3),
  ('office_hours', '"Mon - Sat, 9:30 AM - 5:30 PM"', 4),
  ('google_map', '"https://www.google.com/maps?q=Eaglewood+Polytechnic+Institute+Majalgaon&output=embed"', 5),
  ('institute_name', '"Eaglewood Polytechnic Institute"', 6),
  ('footer_tagline', '"AICTE Approved • MSBTE Affiliated"', 7),
  ('social_links', '{"facebook":"https://www.facebook.com/people/Eaglewood-Polytechnic-Institute-Phule-Pimpalgaon-Majalgaon/100094206302049/","instagram":"https://www.instagram.com/eaglewood_polytechnic/","twitter":"https://x.com/eaglewoodpoly"}', 8)
on conflict (key) do nothing;

-- ── Storage bucket ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms', 'cms', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = excluded.public;

drop policy if exists cms_public_read on storage.objects;
create policy cms_public_read on storage.objects for select using (bucket_id = 'cms');

drop policy if exists cms_admin_upload on storage.objects;
create policy cms_admin_upload on storage.objects
  for all using (bucket_id = 'cms' and public.is_admin())
  with check (bucket_id = 'cms' and public.is_admin());

-- ── PostgREST schema reload ─────────────────────────────────────────────────

notify pgrst, 'reload schema';
