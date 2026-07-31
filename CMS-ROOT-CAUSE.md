# CMS Connection — Root Cause Analysis

**Date:** 2026-07-31  
**Project:** `rhqmquaojetmzdznbevz.supabase.co`  
**Verdict:** The health check is **correct**. The CMS is disconnected because **the database migration has never been applied**.

---

## 1. Where the dashboard decides CMS is "not connected"

| Location | Function | Condition |
|----------|----------|-----------|
| `admin/dashboard.js:134` | `connectCms({ force: true })` | Sets `cmsConnection.connected` |
| `admin/dashboard.js:158` | `updateConnectionBanner()` | Shows banner when `!cmsConnection.connected && !isCmsAvailable()` |
| `admin/dashboard.js:266-271` | `updateSystemStatus()` | DB chip text from `getCmsStatusLabel()` |
| `admin/dashboard.js:340+` | `loadDashboard()` | `cmsReady = isCmsAvailable()` gates live data cards |
| `assets/js/supabase.js:81-83` | **`isCmsAvailable()`** | **Authoritative gate:** `sessionStorage.ew_cms_status === "ready"` |
| `assets/js/supabase.js:193-236` | **`connectCms()`** | Sets `ew_cms_status` to `"ready"` only if `settings` table responds HTTP 200 |

The banner text *"Run supabase/RUN_ALL_MIGRATIONS.sql..."* is rendered by `updateConnectionBanner()` when `connectCms()` returns `{ connected: false }`.

---

## 2. JavaScript function responsible

**Primary:** `connectCms()` → `probeSchemaCapabilities({ verifyFull: true })` in `assets/js/supabase.js`

**Gate:** `isCmsAvailable()` returns `false` until `sessionStorage.setItem("ew_cms_status", "ready")` is set, which only happens when:

```javascript
const { error: settingsError } = await supabase.from("settings").select("id").limit(1);
caps.settings = !settingsError && !isMissingTableError(settingsError);
// caps.settings === true  →  setCachedStatus("ready")
```

---

## 3. Every Supabase query during dashboard startup

Executed in order by `connectCms()` on `DOMContentLoaded`:

| Step | Method | Endpoint | Table | Schema | Columns | Expected | Actual (live) |
|------|--------|----------|-------|--------|---------|----------|---------------|
| 1 | GET | `/rest/v1/admins?select=*&limit=1` | `admins` | `public` | `*` | HTTP 200 | **HTTP 200** ✓ |
| 2 | GET | `/rest/v1/settings?select=id&limit=1` | `settings` | `public` | `id` | HTTP 200 | **HTTP 404** ✗ |
| 3 | POST | `/rest/v1/rpc/get_admin_login_route` | RPC | `public` | `p_email` | HTTP 200 | **SKIPPED** (step 2 failed) |

Reproduce: `node scripts/trace-cms-startup.js`

After step 2 fails, `connectCms()` sets `ew_cms_status = "partial"`, marks 19 tables as `missing` without querying them, and returns `{ connected: false, reason: "migration_required" }`.

`loadDashboard()` then runs `safeCount()` per module — those return `{ ok: false, reason: "missing_table" }` from cache **without additional network calls** (admin mode + pre-marked missing).

---

## 4. FIRST failing request

```
GET https://rhqmquaojetmzdznbevz.supabase.co/rest/v1/settings?select=id&limit=1
HTTP 404
{
  "code": "PGRST205",
  "message": "Could not find the table 'public.settings' in the schema cache",
  "hint": "Perhaps you meant the table 'public.admins'"
}
```

---

## 5. WHY it fails

PostgREST error **PGRST205** means the table **does not exist** in the Postgres `public` schema (or is not exposed). The hint confirms only `public.admins` exists.

This is **not**:
- ❌ Wrong project URL — `admins` returns 200 on the same URL
- ❌ Wrong API key — same key works for `admins`
- ❌ RLS policy — RLS returns 403/empty rows, not PGRST205
- ❌ Health-check bug — probe correctly interprets 404 as disconnected
- ❌ Wrong import / config bug — `cms.enabled: true` in `config.js`
- ❌ Missing RPC — RPC probe is never reached; connection gate is `settings` table

This **is**:
- ✅ **Missing migration** — `RUN_ALL_MIGRATIONS.sql` has never been executed on project `rhqmquaojetmzdznbevz`

---

## 6. Live database audit (2026-07-31)

```
node scripts/audit-supabase.js
```

| Resource | Status |
|----------|--------|
| `admins` | OK 200 |
| `settings` + 18 other CMS tables | ERR 404 |
| `admins.auth_user_id`, `permissions`, `status`, `updated_at` | ERR 42703 (column missing) |
| `get_admin_login_route`, `verify_legacy_admin` | ERR 404 PGRST202 |
| Storage bucket `cms` | ERR 400 |

---

## 7. RUN_ALL_MIGRATIONS.sql vs JS queries

```
node scripts/compare-schema-js.js
```

All 20 JS tables have matching DDL in `RUN_ALL_MIGRATIONS.sql`. No schema mismatch between code and SQL file.

| JS module | SQL table | In migration? |
|-----------|-----------|---------------|
| Hero | `home_slides` | ✓ |
| Footer | `footer_blocks` | ✓ |
| Settings | `settings` | ✓ |
| Courses | `courses` | ✓ |
| Gallery | `gallery` | ✓ |
| Contact | `contacts` | ✓ |
| AI | `ai_knowledge_base`, `ai_prompts`, `ai_conversations` | ✓ |
| Admin Users | `admins` | ✓ |

**No JS query references a table or column absent from the migration file.**

---

## 8. Why the bug occurred

The Supabase project was created with only a legacy `admins` table (manual setup). The full CMS migration (`RUN_ALL_MIGRATIONS.sql`) was **never run** in the SQL Editor. The frontend was enabled (`cms.enabled: true`) and correctly detects the incomplete schema.

---

## 9. How to fix (required — no JS workaround)

The dashboard **will** show "Connected" automatically once `public.settings` exists. No code change can substitute for this.

### Option A — SQL Editor (one-time)

1. Open https://supabase.com/dashboard/project/rhqmquaojetmzdznbevz/sql/new
2. Paste entire contents of `supabase/RUN_ALL_MIGRATIONS.sql`
3. Click **Run**
4. Hard-refresh admin dashboard (or switch tabs — auto-reconnect runs)

### Option B — CLI

```bash
# Copy .env.local.example → .env.local, set SUPABASE_DB_URL from
# Dashboard → Project Settings → Database → Connection string (URI)
npm run db:migrate
npm run audit:supabase   # must exit 0
```

### After migration

Create Supabase Auth user `admin@eaglewoodpoly.in` (same password) for CRUD write access via RLS.

---

## 10. Files (diagnostic scripts added)

| File | Purpose |
|------|---------|
| `scripts/trace-cms-startup.js` | Replays exact startup queries with responses |
| `scripts/audit-supabase.js` | Full table/column/RPC/bucket audit |
| `scripts/compare-schema-js.js` | JS tables vs SQL DDL |
| `scripts/run-migrations.js` | Apply migration via `SUPABASE_DB_URL` |

**No JS health-check logic was changed** — it is working as designed.

---

## 11. Expected state after fix

```
node scripts/trace-cms-startup.js
# Step 1: admins → HTTP 200
# Step 2: settings → HTTP 200  ← connection gate passes
# ew_cms_status = "ready"
# isCmsAvailable() = true
# getCmsStatusLabel() = "Connected"
```

```
node scripts/audit-supabase.js
# All checks pass, exit 0
```
