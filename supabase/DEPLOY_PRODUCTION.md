-- Eaglewood Polytechnic — PRODUCTION DEPLOYMENT (single file)
--
-- Run ONCE in Supabase Dashboard → SQL Editor:
--   https://supabase.com/dashboard/project/rhqmquaojetmzdznbevz/sql/new
--
-- This file combines:
--   • APPLY_ADMIN_WRITE_FIX.sql  (legacy admin write sessions)
--   • APPLY_CMS_SYNC.sql         (bootstrap RPC + seed all CMS tables)
--
-- Prerequisites: RUN_ALL_MIGRATIONS.sql must already be applied.
--
-- After running:
--   npm run verify:cms
--   Sign out and sign in to admin panel

\i APPLY_ADMIN_WRITE_FIX.sql
\i APPLY_CMS_SYNC.sql
