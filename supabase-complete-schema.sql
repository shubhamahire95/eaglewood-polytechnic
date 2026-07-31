-- Eaglewood Polytechnic Institute complete Supabase CMS schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  name text,
  email text,
  role text default 'admin',
  active boolean default true,
  created_at timestamptz default now()
);

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  category text,
  is_public boolean default true,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.home_slides (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  description text,
  image_url text,
  mobile_image_url text,
  button_text text,
  button_link text,
  button_primary_label text,
  button_primary_url text,
  button_secondary_label text,
  button_secondary_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.principal_message (
  id uuid primary key default gen_random_uuid(),
  title text,
  heading text,
  message text,
  short_message text,
  full_message text,
  principal_name text,
  name text,
  designation text,
  photo_url text,
  button_text text,
  button_link text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  slug text,
  duration text,
  intake integer,
  seats integer,
  code text,
  eligibility text,
  description text,
  image_url text,
  brochure_url text,
  button_text text,
  button_link text,
  button_label text,
  button_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  slug text,
  description text,
  hod_name text,
  hod_photo_url text,
  department_image_url text,
  image_url text,
  contact_email text,
  labs text,
  faculty_count integer,
  students_count integer,
  button_text text,
  button_link text,
  button_label text,
  button_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  title text,
  short_title text,
  slug text,
  description text,
  image_url text,
  icon text,
  link text,
  button_url text,
  category text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  description text,
  image_url text,
  alt text,
  category text,
  event_date date,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image_url text,
  attachment_url text,
  link text,
  date date,
  publish_date date,
  button_label text,
  button_url text,
  display_order integer default 0,
  priority integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  document_url text,
  pdf_url text,
  notice_date date,
  date date,
  priority integer default 0,
  important boolean default false,
  is_new boolean default false,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image_url text,
  company_name text,
  student_name text,
  academic_year text,
  placement_type text,
  placed_students integer,
  testimonial text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  title text,
  authority_name text,
  approval_title text,
  approval_number text,
  academic_year text,
  document_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  document_type text,
  academic_year text,
  file_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  name text,
  title text,
  description text,
  chairperson text,
  members jsonb,
  document_url text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  course text,
  message text,
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text,
  phone text,
  email text,
  course text,
  previous_school text,
  address text,
  notes text,
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  category text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_categories (
  id uuid primary key default gen_random_uuid(),
  title text,
  name text,
  icon text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_training (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  tags text[],
  source text,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_faqs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.ai_categories(id) on delete set null,
  category text,
  question text,
  answer text,
  keywords text[],
  priority integer default 0,
  display_order integer default 0,
  published boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into storage.buckets (id, name, public) values
  ('website-images', 'website-images', true),
  ('documents', 'documents', true)
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['settings','home_slides','principal_message','courses','departments','facilities','gallery','updates','notices','placements','approvals','documents','committees','inquiries','admission_applications','newsletter_subscribers','admins','ai_settings','ai_categories','ai_training','ai_faqs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_manage_%I on public.%I', t, t);
    execute format('create policy admin_manage_%I on public.%I for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin())', t, t);
  end loop;
end $$;

drop policy if exists public_read_settings on public.settings;
create policy public_read_settings on public.settings for select to anon, authenticated using (is_public = true and published = true and is_active = true);

do $$
declare t text;
begin
  foreach t in array array['home_slides','principal_message','courses','departments','facilities','gallery','updates','notices','placements','approvals','documents','committees'] loop
    execute format('drop policy if exists public_read_%I on public.%I', t, t);
    execute format('create policy public_read_%I on public.%I for select to anon, authenticated using (published = true and is_active = true)', t, t);
  end loop;
end $$;

drop policy if exists public_read_ai_settings on public.ai_settings;
create policy public_read_ai_settings on public.ai_settings for select to anon, authenticated using (published = true and is_active = true);
drop policy if exists public_read_ai_categories on public.ai_categories;
create policy public_read_ai_categories on public.ai_categories for select to anon, authenticated using (published = true and is_active = true);
drop policy if exists public_read_ai_training on public.ai_training;
create policy public_read_ai_training on public.ai_training for select to anon, authenticated using (published = true and is_active = true);
drop policy if exists public_read_ai_faqs on public.ai_faqs;
create policy public_read_ai_faqs on public.ai_faqs for select to anon, authenticated using (published = true and is_active = true);

drop policy if exists public_create_inquiries on public.inquiries;
create policy public_create_inquiries on public.inquiries for insert to anon, authenticated with check (true);
drop policy if exists public_create_admission_applications on public.admission_applications;
create policy public_create_admission_applications on public.admission_applications for insert to anon, authenticated with check (true);
drop policy if exists public_create_newsletter_subscribers on public.newsletter_subscribers;
create policy public_create_newsletter_subscribers on public.newsletter_subscribers for insert to anon, authenticated with check (true);

drop policy if exists public_read_images on storage.objects;
create policy public_read_images on storage.objects for select to anon, authenticated using (bucket_id in ('website-images','documents'));
drop policy if exists admin_manage_storage on storage.objects;
create policy admin_manage_storage on storage.objects for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

do $$
declare t text;
begin
  foreach t in array array['settings','home_slides','principal_message','courses','departments','facilities','gallery','updates','notices','placements','approvals','documents','committees','inquiries','admission_applications','ai_settings','ai_categories','ai_training','ai_faqs'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
