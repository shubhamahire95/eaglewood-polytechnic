-- Eaglewood Polytechnic Institute production schema patch
-- Run this in the Supabase SQL editor after reviewing the target project.

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

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  published boolean default true,
  status text default 'active',
  display_order integer default 0,
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

create table if not exists public.ai_questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.ai_categories(id) on delete set null,
  question text not null,
  answer text not null,
  keywords text[] default '{}',
  priority integer default 0,
  published boolean default true,
  views integer default 0,
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

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  question text not null,
  answer text,
  confidence integer default 0,
  source text,
  browser text,
  created_at timestamptz default now()
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  rating integer,
  feedback text,
  created_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['settings','ai_settings','ai_categories','ai_questions','ai_training','ai_faqs','ai_logs','ai_feedback'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists public_read_settings on public.settings;
create policy public_read_settings on public.settings for select using (published = true and status = 'active');
drop policy if exists admin_manage_settings on public.settings;
create policy admin_manage_settings on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_ai_settings on public.ai_settings;
create policy public_read_ai_settings on public.ai_settings for select using (published = true and status = 'active');
drop policy if exists admin_manage_ai_settings on public.ai_settings;
create policy admin_manage_ai_settings on public.ai_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_ai_categories on public.ai_categories;
create policy public_read_ai_categories on public.ai_categories for select using (status = 'active');
drop policy if exists admin_manage_ai_categories on public.ai_categories;
create policy admin_manage_ai_categories on public.ai_categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_ai_questions on public.ai_questions;
create policy public_read_ai_questions on public.ai_questions for select using (published = true);
drop policy if exists public_update_ai_question_views on public.ai_questions;
create policy public_update_ai_question_views on public.ai_questions for update using (published = true) with check (published = true);
drop policy if exists admin_manage_ai_questions on public.ai_questions;
create policy admin_manage_ai_questions on public.ai_questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_ai_training on public.ai_training;
create policy public_read_ai_training on public.ai_training for select using (published = true and status = 'active');
drop policy if exists public_insert_unanswered_ai_training on public.ai_training;
create policy public_insert_unanswered_ai_training on public.ai_training for insert with check (published = false);
drop policy if exists admin_manage_ai_training on public.ai_training;
create policy admin_manage_ai_training on public.ai_training for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_read_ai_faqs on public.ai_faqs;
create policy public_read_ai_faqs on public.ai_faqs for select using (published = true and status = 'active');
drop policy if exists admin_manage_ai_faqs on public.ai_faqs;
create policy admin_manage_ai_faqs on public.ai_faqs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_insert_ai_logs on public.ai_logs;
create policy public_insert_ai_logs on public.ai_logs for insert with check (true);
drop policy if exists admin_manage_ai_logs on public.ai_logs;
create policy admin_manage_ai_logs on public.ai_logs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists public_insert_ai_feedback on public.ai_feedback;
create policy public_insert_ai_feedback on public.ai_feedback for insert with check (true);
drop policy if exists admin_manage_ai_feedback on public.ai_feedback;
create policy admin_manage_ai_feedback on public.ai_feedback for all using (public.is_admin()) with check (public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array['settings','ai_settings','ai_categories','ai_questions','ai_training','ai_faqs'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

insert into public.ai_settings (key, value, display_order) values
  ('assistant_name', '"Eaglewood AI Assistant"'::jsonb, 1),
  ('primary_color', '"#0F766E"'::jsonb, 2),
  ('suggested_questions', '["Admissions","Courses","Contact","Fees","Departments","Scholarships","Call Office","WhatsApp Admission Help"]'::jsonb, 3)
on conflict (key) do nothing;