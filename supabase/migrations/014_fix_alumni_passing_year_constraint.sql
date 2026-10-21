-- Normalize the Alumni passing year CHECK constraint.
-- Safe to run more than once. It removes the misspelled/legacy variants
-- and restores the intended rule: optional four-digit years from 1950 to 2100.

alter table if exists public.alumni
  drop constraint if exists alumni_passing_year_same;

alter table if exists public.alumni
  drop constraint if exists alumni_passing_year_sane;

alter table if exists public.alumni
  add constraint alumni_passing_year_sane
  check (passing_year is null or passing_year between 1950 and 2100);

notify pgrst, 'reload schema';
