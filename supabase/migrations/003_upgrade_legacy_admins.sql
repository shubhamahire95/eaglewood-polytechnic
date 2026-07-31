-- Upgrade legacy admins table before / after 001
alter table public.admins add column if not exists auth_user_id uuid unique;
alter table public.admins add column if not exists status text default 'active';
alter table public.admins add column if not exists permissions jsonb default '{}'::jsonb;
alter table public.admins add column if not exists updated_at timestamptz default now();
update public.admins set status = 'active' where status is null;
