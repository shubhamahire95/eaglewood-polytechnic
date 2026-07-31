# Backend Audit Report

**Project:** `rhqmquaojetmzdznbevz.supabase.co`  
**Date:** 2026-07-31  
**Status:** Migration required on live database

## Root cause

The live Supabase project has only a **legacy `admins` table**. Migrations were never applied. The JavaScript app queries 20 CMS tables and 2 RPC functions that do not exist yet.

## Live probe results

### Missing tables (19)

| SQL table | User alias |
|-----------|------------|
| `settings` | settings |
| `home_slides` | hero |
| `principal_message` | principal |
| `notices` | important_notices |
| `footer_blocks` | footer |
| `contacts` | contact |
| `ai_knowledge_base` | ai_faqs |
| `media_library` | media |
| `updates` | updates |
| `courses` | courses |
| `departments` | departments |
| `faculty` | faculty |
| `facilities` | facilities |
| `placements` | placements |
| `gallery` | gallery |
| `inquiries` | — |
| `admissions` | admissions |
| `ai_prompts` | — |
| `ai_conversations` | — |

**Present:** `admins` only

### Missing columns on `admins`

| Column | Required by |
|--------|-------------|
| `auth_user_id` | Auth linking, `is_admin()`, login route |
| `status` | Admin active check |
| `permissions` | Admin CRUD permissions |
| `updated_at` | Triggers |

**Present:** `id`, `name`, `email`, `password`, `role`, `created_at`

### Missing RPC functions

| Function | Purpose |
|----------|---------|
| `get_admin_login_route` | Detect auth vs legacy login without exposing password |
| `verify_legacy_admin` | Secure legacy password check (security definer) |

**Also required:** `is_admin()`, `set_updated_at()` — created by migration 001/002

### Missing RLS policies

All RLS policies from `001_eaglewood_cms.sql` and `002_admin_auth_fixes.sql` are missing until migration runs:

- `public_read_published` on CMS content tables
- `verified_admin_manage` on all CMS tables
- `public_insert` on `inquiries`, `admissions`, `contacts`, `ai_conversations`
- `admin_self_or_admin_read` on `admins`
- `cms_public_read` / `cms_admin_upload` on `storage.objects`

### Missing storage buckets

| Bucket | Purpose |
|--------|---------|
| `cms` | Admin media uploads |

### Missing indexes

Created by `004_indexes.sql` after main migration.

## Errors eliminated in JavaScript (pre-migration)

| Error | Fix |
|-------|-----|
| `404 /rest/v1/settings` | `ensureCmsReady()` probes `admins` only; settings checked only on Retry |
| `404 /rpc/get_admin_login_route` | RPC skipped until `verifyFull`; legacy column-safe fallback |
| `400 /rest/v1/admins` (auth_user_id) | Schema caps from `select("*")`; no missing column in queries |
| `400 /auth/v1/token` | Legacy login tried first; Auth only when route is `auth` or `auth_user_id` set |

## Fix: run migration

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/rhqmquaojetmzdznbevz/sql)
2. Paste entire contents of `supabase/RUN_ALL_MIGRATIONS.sql`
3. Run
4. Hard-refresh admin + public site
5. Click **Retry connection** in admin dashboard
6. Verify: `node scripts/audit-supabase.js` → all checks pass

## Query manifest (JS → SQL)

Every query in the project maps to tables in `assets/js/supabase.js` `CMS_TABLES`. No queries to non-existent tables like `hero`, `users`, `permissions`, `media`, `contact` — those are aliases documented in `supabase/TABLES.md`.

## Verification checklist (post-migration)

- [ ] `node scripts/audit-supabase.js` — 0 failures
- [ ] Admin login with `admin@eaglewoodpoly.in` / `admin123`
- [ ] Dashboard shows Connected
- [ ] Public site loads CMS content (or static fallbacks until content added)
- [ ] Browser Network tab — no 404/400 on REST or RPC
