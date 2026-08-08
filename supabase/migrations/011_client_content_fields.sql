-- Client content fields: program types, dual principals, downloads, institute stats

alter table public.departments
  add column if not exists program_type text default 'diploma';

alter table public.courses
  add column if not exists program_type text default 'diploma';

alter table public.principal_message
  add column if not exists institute text default 'polytechnic',
  add column if not exists qualification text;

insert into public.settings (key, value, published, display_order) values
  ('stat_departments', '"6"', true, 100),
  ('stat_placements', '"85%"', true, 101),
  ('stat_faculty', '"75"', true, 102),
  ('stat_institute_code', '"2634"', true, 103),
  ('contact_phones', '["+91 94237 16230","+91 97655 43454","+91 90281 85454","+91 90493 44003"]', true, 50),
  ('email_polytechnic', '"eaglewoodpoly@gmail.com"', true, 51),
  ('email_engineering', '"eaglewoodcoe@gmail.com"', true, 52)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
