-- Eaglewood Polytechnic public website schema
-- Run in Supabase SQL editor. Keeps RLS enabled and uses public.is_admin() for admin writes.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where auth_user_id = auth.uid()
      and status = 'active'
      and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  title text,
  description text,
  category text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.principal_message (
  id uuid primary key default gen_random_uuid(),
  title text,
  heading text,
  name text,
  principal_name text,
  designation text,
  message text,
  description text,
  photo_url text,
  image_url text,
  signature text,
  button_text text default 'Read Full Message',
  button_link text default 'about.html#principal',
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  name text,
  description text,
  image_url text,
  icon text,
  link text,
  category text,
  duration text,
  seats integer,
  code text,
  eligibility text,
  button_label text,
  button_url text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  name text,
  description text,
  image_url text,
  department_image_url text,
  hod_name text,
  hod_photo_url text,
  labs text,
  faculty_count integer default 0,
  students_count integer default 0,
  icon text,
  link text,
  category text,
  button_label text,
  button_url text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_title text,
  name text,
  description text,
  image_url text,
  icon text,
  link text,
  category text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  name text,
  description text,
  image_url text,
  alt text,
  icon text,
  link text,
  category text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  name text,
  description text,
  message text,
  image_url text,
  icon text,
  link text,
  category text,
  color text,
  date date default current_date,
  button_label text,
  button_url text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  description text,
  image_url text,
  icon text,
  link text,
  category text,
  recruiter text,
  company_logo_url text,
  highest_package text,
  average_package text,
  placed_students integer default 0,
  testimonial text,
  student_name text,
  course text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  published boolean default true,
  status text default 'active',
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_categories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text,
  status text default 'active',
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_training (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text default '',
  tags text[] default '{}',
  source text,
  published boolean default true,
  status text default 'active',
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  keywords text[] default '{}',
  priority integer default 0,
  published boolean default true,
  status text default 'active',
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['settings','principal_message','courses','departments','facilities','gallery','updates','placements','ai_settings','ai_categories','ai_training','ai_faqs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists public_read on public.%I', t);
    if t = 'ai_categories' then
      execute format('create policy public_read on public.%I for select using (status = ''active'')', t);
    elsif t in ('ai_settings','ai_training','ai_faqs') then
      execute format('create policy public_read on public.%I for select using (published = true and status = ''active'')', t);
    else
      execute format('create policy public_read on public.%I for select using (published = true)', t);
    end if;
    execute format('drop policy if exists admin_manage on public.%I', t);
    execute format('create policy admin_manage on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

insert into public.ai_settings (key, value, display_order) values
  ('assistant_name', '"Eaglewood AI Assistant"'::jsonb, 1),
  ('primary_color', '"#0F766E"'::jsonb, 2),
  ('suggested_questions', '["Admissions","Courses","Contact","Fees","Departments","Scholarships","Call Office","WhatsApp Admission Help"]'::jsonb, 3)
on conflict (key) do nothing;