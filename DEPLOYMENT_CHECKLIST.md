# Eaglewood Polytechnic — Production Deployment Checklist

Last verified: 2026-07-28

## Pre-deploy (Supabase)

- [x] Apply `supabase/GENERATED_FIX_ADMIN_WRITES.sql` in Supabase SQL Editor
- [x] Confirm `is_admin()` returns `true` for legacy admin headers
- [x] Confirm `cms` storage bucket exists and accepts admin uploads
- [x] Confirm RLS: public read (published), admin manage, public insert on forms
- [x] Seed content present (principal, slides, notices, updates, settings, etc.)

## Automated verification (run before deploy)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run verify:all-crud` | **PASS 27/27** | Admin CRUD, forms, storage upload/delete |
| `npm run verify:production-api` | **PASS** | Login RPC, writes, public forms, seeded tables, storage |
| `npm run verify:site` | **PASS 14/14** | All public + admin pages, zero console errors, CMS homepage sections |

## Critical production fixes applied

### Reliability
- [x] Global error handlers (`assets/js/errors.js`) on public site + admin
- [x] Fixed `DOMContentLoaded` race when Supabase CDN delays module init (`main.js`)
- [x] Failed query cache no longer sticks permanently (`safeFetch` / `safeCount`)
- [x] `ensureCmsReady` only clears failed promise on failure (allows retry)
- [x] Duplicate home page listeners prevented (`bindHomeChromeOnce`, `bindPremiumInteractionsOnce`)
- [x] Swiper instances destroyed before re-init on CMS refresh
- [x] Admin module retry button wired on all error paths
- [x] `switchModule` / `loadModule` async errors surfaced via toast
- [x] Form queue flush on admin load (`flushFormQueue`)
- [x] Removed duplicate per-module bootstrap after global `bootstrapAllContentTables`

### CRUD / data integrity
- [x] No fake `local-*` UUIDs sent to PostgREST
- [x] INSERT when no UUID; PATCH only with valid UUID (`cms-store.js`)
- [x] Payload sanitization via `cms-schema.js` (unknown columns stripped, empty dates → null)
- [x] Public form insert uses `return=minimal` (no SELECT-after-insert RLS failure)
- [x] Storage DELETE omits empty JSON `Content-Type` header

### Error handling
- [x] HTTP status mapping (400, 401, 403, 404, 409, 422, 429, 5xx)
- [x] Offline / network / timeout messages via `mapApiError`
- [x] AI feedback saves guarded; no uncaught promise rejections
- [x] `localStorage` / `sessionStorage` access wrapped where needed

### Performance / logging
- [x] CRUD debug logs gated behind `isDevelopmentEnv()`
- [x] Connection diagnostics gated behind development mode
- [x] Homepage render de-duplicated (`homeRenderPromise`)
- [x] Dashboard load de-duplicated (`dashboardLoadPromise`)

## Admin panel — module verification

| Module | Create | Edit | Delete | Upload | Search | Status |
|--------|--------|------|--------|--------|--------|--------|
| Dashboard | — | — | — | — | — | ✓ |
| Hero Slides | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Principal Message | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Updates | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notices | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Courses | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Departments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faculty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Facilities | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Placements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gallery | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Media Library | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admissions | read/export | ✓ | ✓ | — | ✓ | ✓ |
| Contacts | read/export | ✓ | ✓ | — | ✓ | ✓ |
| Inquiries | read/export | ✓ | ✓ | — | ✓ | ✓ |
| AI Knowledge | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| AI Prompts | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| AI Conversations | read/export | — | — | — | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Footer Blocks | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Admin Users | ✓ | ✓ | ✓ | — | ✓ | ✓ |

**Save UX:** modal closes, data refreshes, success toast, public cache notified (`notifyCmsDataChanged`).

## Public website

- [x] Homepage CMS sections render (hero, principal, updates, notices, courses, departments, mission)
- [x] All 14 pages: zero console errors, zero broken local assets
- [x] Admin changes propagate via `ew_cms_updated_at` storage event + focus refresh
- [x] Contact / admission / inquiry forms submit to Supabase (or local queue fallback)
- [x] AI assistant widget loads with knowledge base + fallback responses

## AI assistant

- [x] Knowledge base CRUD (admin)
- [x] Prompt CRUD (admin)
- [x] Conversation logging + feedback rating
- [x] Context retrieval from published knowledge
- [x] Fallback responses when no match
- [x] Public widget on all pages

## Deploy steps

1. Run all verification commands above — all must PASS
2. Deploy static files (`index.html`, `assets/`, `admin/`, etc.) to hosting
3. Ensure HTTPS is enabled (required for secure storage / modern APIs)
4. Confirm `assets/js/config.js` has `env: "production"`
5. Log in to admin (`admin/login.html`) and confirm dashboard module counts
6. Smoke test: edit a notice → verify it appears on homepage within one refresh
7. Smoke test: upload an image → verify preview + public URL resolve
8. Smoke test: submit contact form → verify row in admin Contacts module

## Post-deploy monitoring

- [ ] Browser console: zero errors on homepage and admin dashboard
- [ ] Network tab: no failed Supabase REST or storage requests during CRUD
- [ ] No `42501` (RLS) or `22P02` (invalid UUID) in admin saves
- [ ] Form submissions appear in admin within seconds

## Known non-blockers

- `verify:full` may fail if port `8885` is already in use — stop other local servers first
- Bootstrap RPC (`bootstrap_cms_default_content`) is optional; admin REST seed is used instead
- `console.warn` for non-critical storage cleanup failures during image replace (old file missing)

## Rollback

1. Revert static deploy to previous hosting snapshot
2. Database rollback is **not** required for static-only deploys
3. If migration caused issues, restore Supabase from dashboard backup before re-applying SQL
