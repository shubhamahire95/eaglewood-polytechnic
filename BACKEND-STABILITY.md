# Backend Stability Gate

**Do not redesign frontend pages until every item below is checked.**

Frontend redesign is blocked until the backend passes this gate.

---

## Required state

| Check | How to verify |
|-------|----------------|
| Zero console errors | Open site + admin in browser DevTools → Console |
| Zero missing tables | Admin dashboard → Database Health → Missing tables = **None** |
| Zero 404 REST calls | Network tab → filter `rest/v1` → no 404 responses |
| Dashboard working | Admin loads overview, status cards, feeds without errors |
| CRUD working | Create / edit / delete a notice in admin |
| Schema complete | All 20 tables exist in Supabase |

---

## Setup (run in order)

### 1. Run migrations in Supabase SQL Editor

Run **`supabase/RUN_ALL_MIGRATIONS.sql`** (single paste — order 003 → 001 → 002 → 004).

Verify: `node scripts/audit-supabase.js`

### 2. Enable CMS

In `assets/js/config.js`:

```js
cms: {
    enabled: true,
    storageBucket: "cms",
},
```

### 3. Create admin user (Supabase Auth only)

1. **Authentication → Users → Add user** with email + password.
2. Run **`supabase/fix_admin_login.sql`** in SQL Editor (confirms email + links `auth_user_id`).

Or with database URL:

```bash
# Add SUPABASE_DB_URL to .env.local, then:
node scripts/setup-admin-auth.js --email admin@eaglewoodpoly.in --password 'your-password'
```

Manual SQL (if needed):

```sql
UPDATE public.admins
SET auth_user_id = 'PASTE_AUTH_UID', status = 'active'
WHERE email = 'admin@eaglewoodpoly.in';
```

### 4. Hard refresh

Ctrl+Shift+R on public site and admin panel.

---

## Behaviour when CMS is disabled

With `cms.enabled: false` (default):

- Public site makes **zero** REST calls
- Static fallbacks render homepage content
- Admin login shows setup message
- No 404 errors in Network tab

This is intentional until migrations are run.

---

## Tables (20)

`settings`, `home_slides`, `principal_message`, `updates`, `notices`, `courses`, `departments`, `faculty`, `facilities`, `placements`, `gallery`, `media_library`, `footer_blocks`, `contacts`, `admissions`, `inquiries`, `ai_knowledge_base`, `ai_prompts`, `ai_conversations`, `admins`

See `supabase/TABLES.md` for the full manifest.

---

## Auth architecture

**Supabase Auth only** — login uses `signInWithPassword`. The `admins` table stores profile, role, and status only.

| Step | Method |
|------|--------|
| Login | `supabase.auth.signInWithPassword({ email, password })` |
| Profile | `public.admins` where `auth_user_id = auth.user.id` and `status = 'active'` |
| CRUD | RLS via `is_admin()` (matches `auth_user_id` or JWT email) |
| Logout | `supabase.auth.signOut()` |

### Link admin to Auth user

1. Create user in Supabase Dashboard → Authentication → Users
2. SQL Editor:

```sql
INSERT INTO public.admins (email, name, auth_user_id, role, status)
VALUES ('admin@eaglewoodpoly.in', 'Admin', 'PASTE_AUTH_USER_UUID', 'admin', 'active')
ON CONFLICT (email) DO UPDATE
SET auth_user_id = EXCLUDED.auth_user_id, status = 'active';
```

Sign in at `/admin/login.html` with the Auth email and password.

---

## Verification script

```bash
python tmp/verify_site.py
```

Checks HTML asset references resolve locally (not Supabase).

---

## After gate passes

Only then:

- Redesign inner pages (about, courses, departments, etc.)
- Add new CMS modules
- Visual polish on public site
