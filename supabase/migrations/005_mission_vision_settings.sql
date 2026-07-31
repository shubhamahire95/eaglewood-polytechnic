-- Mission, Vision, and extended principal fields (idempotent)

alter table public.principal_message add column if not exists qualification text;

insert into public.settings (key, value, display_order) values
  ('mission', '"To deliver industry-oriented engineering education with discipline, practical exposure and ethical values."', 20),
  ('vision', '"To be a leading polytechnic nurturing confident engineers for society and industry."', 21),
  ('objectives', '["Hands-on laboratory learning","Industry-aligned curriculum","Student mentoring and placement support","Inclusive campus culture"]', 22),
  ('core_values', '["Integrity","Innovation","Discipline","Excellence","Service"]', 23),
  ('developer_name', '"Shubham Ahire"', 30),
  ('developer_phone', '"+91 7249868133"', 31),
  ('logo_url', '"/assets/images/logo.jpg"', 32)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
