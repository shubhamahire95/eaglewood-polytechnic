# Production Verification Checklist

Apply `supabase/GENERATED_FIX_ADMIN_WRITES.sql` in **Supabase Dashboard → SQL Editor**, then verify each item below.

Project: `https://rhqmquaojetmzdznbevz.supabase.co`  
Admin login: `admin@eaglewoodpoly.in` / `admin123`

---

## Phase 1 — SQL applied successfully

- [ ] SQL Editor shows **Success. No rows returned** (or only `NOTIFY` result)
- [ ] No error lines in the SQL output panel

---

## Phase 2 — Database objects (SQL Editor or API)

Run these in SQL Editor:

```sql
-- 2a. Tables
select exists (select 1 from information_schema.tables where table_schema='public' and table_name='admin_sessions') as admin_sessions;

-- 2b. Functions
select proname from pg_proc p join pg_namespace n on p.pronamespace=n.oid
where n.nspname='public' and proname in (
  'legacy_admin_from_headers','legacy_admin_session_admin_id',
  'create_legacy_admin_session','destroy_legacy_admin_session',
  'verify_legacy_admin','is_admin'
) order by proname;

-- 2c. Storage bucket
select id, public from storage.buckets where id = 'cms';
```

Expected:
- [ ] `admin_sessions` = `true`
- [ ] All 6 functions listed
- [ ] `cms` bucket exists with `public = true`

---

## Phase 3 — Auth (REST or admin login)

From terminal (project root):

```bash
npm run audit:database
```

Or test manually in SQL Editor → API:

| Check | Expected |
|-------|----------|
| `verify_legacy_admin('admin@eaglewoodpoly.in','admin123')` | JSON with `session_token` field |
| `is_admin()` with `x-admin-email` + `x-admin-password` headers | `true` |
| `legacy_admin_from_headers()` with admin headers | UUID (not 404) |

- [ ] Login works
- [ ] Session token generated
- [ ] `is_admin()` returns `true`
- [ ] Header authentication works

---

## Phase 4 — Seed CMS content (if tables empty)

```bash
npm run cms:seed
```

Expected: rows inserted into `home_slides`, `principal_message`, `updates`, `notices`, `courses`, etc.

- [ ] `settings` has rows (≥8 keys)
- [ ] `home_slides` has rows
- [ ] `principal_message` has rows
- [ ] `footer_blocks` has rows
- [ ] All other CMS tables have content

---

## Phase 5 — Admin panel (manual)

Open `/admin/login.html`, log in, test each module:

| Module | Create | Read | Update | Delete | Image upload |
|--------|--------|------|--------|--------|--------------|
| Hero (home_slides) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Principal Message | ☐ | ☐ | ☐ | ☐ | ☐ |
| Updates | ☐ | ☐ | ☐ | ☐ | ☐ |
| Notices | ☐ | ☐ | ☐ | ☐ | ☐ |
| Courses | ☐ | ☐ | ☐ | ☐ | ☐ |
| Departments | ☐ | ☐ | ☐ | ☐ | ☐ |
| Faculty | ☐ | ☐ | ☐ | ☐ | ☐ |
| Facilities | ☐ | ☐ | ☐ | ☐ | ☐ |
| Placements | ☐ | ☐ | ☐ | ☐ | ☐ |
| Gallery | ☐ | ☐ | ☐ | ☐ | ☐ |
| Footer Blocks | ☐ | ☐ | ☐ | ☐ | ☐ |
| AI Knowledge | ☐ | ☐ | ☐ | ☐ | ☐ |
| AI Assistant (prompts) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Media Library | ☐ | ☐ | ☐ | ☐ | ☐ |
| Inquiries | ☐ | ☐ | ☐ | ☐ | — |
| Admissions | ☐ | ☐ | ☐ | ☐ | — |
| Contacts | ☐ | ☐ | ☐ | ☐ | — |

- [ ] No toast errors on Save
- [ ] No `42501` RLS errors in browser Network tab
- [ ] No `400` errors with `local-*` fake IDs

---

## Phase 6 — Storage

In admin Media Library or any image field:

- [ ] Upload JPEG/PNG → succeeds
- [ ] Public URL loads in browser
- [ ] Delete image → succeeds
- [ ] Replace image → succeeds

---

## Phase 7 — Public website

```bash
npm run verify:site
npm run verify:full
```

- [ ] Homepage shows hero, principal, courses, notices from database
- [ ] No seed-fallback content (check Network: data from `/rest/v1/`)
- [ ] Contact form submits (201)
- [ ] Admission form submits (201)
- [ ] AI Assistant saves conversation to `ai_conversations`

---

## Phase 8 — Automated audit

```bash
npm run verify:production-api
npm run verify:all-crud
```

All must exit code 0:

- [ ] `verify:production-api` — PASS
- [ ] `verify:all-crud` — PASS
- [ ] Zero `401` / `403` / `42501` on admin writes
- [ ] Zero console errors on public pages

---

## Quick PASS criteria

**Production is ready when ALL are true:**

1. `is_admin()` = `true` with admin headers  
2. Admin Save works on every module  
3. Image upload to `cms` bucket works  
4. Public forms submit  
5. Website renders live Supabase data  
6. `npm run verify:production-api` passes  
