# Eaglewood Supabase Setup

## Why you see `GET /rest/v1/settings 404`

A **404** on `/rest/v1/settings` means the `settings` table does not exist in your Supabase project **or** PostgREST has not reloaded the schema.

This is a **database setup issue**, not CSS or frontend.

---

## Step 1 — Run the migrations

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Paste and run the entire file:

   **`supabase/RUN_ALL_MIGRATIONS.sql`**

   (Runs 003 → 001 → 002 → 004 in order — upgrades legacy `admins`, creates all tables, RPCs, RLS, bucket, indexes.)

3. Confirm success (no errors in the SQL output)

This creates all **20 tables**, RLS policies, admin auth RPCs, seed settings, and the `cms` storage bucket.

See **`BACKEND-AUDIT.md`** for the full audit report and **`BACKEND-STABILITY.md`** for the stability gate checklist.

---

## Step 2 — Enable CMS in config

Edit **`assets/js/config.js`**:

```js
cms: {
    enabled: true,   // ← change from false to true
    storageBucket: "cms",
},
```

---

## Step 3 — Hard refresh

Clear cache and reload the site (Ctrl+Shift+R).

In the admin dashboard, click **Retry Connection** if needed.

---

## Step 4 — Create admin user

### Option A — Supabase Auth (recommended)

1. Authentication → Users → Add user (email + password)
2. Copy the user's UUID
3. SQL Editor:

```sql
INSERT INTO public.admins (email, name, auth_user_id, role, status)
VALUES ('admin@eaglewoodpoly.in', 'Admin', 'PASTE_AUTH_UID_HERE', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, status = 'active';
```

### Option B — Legacy password in admins table

```sql
INSERT INTO public.admins (email, password, name, role, status)
VALUES ('admin@eaglewoodpoly.in', 'your-password', 'Admin', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;
```

For full CRUD, also create a Supabase Auth user with the **same email and password**, or link `auth_user_id` to an existing Auth user.

---

## Zero 404 behaviour

| `cms.enabled` | Migration run | REST calls |
|---------------|---------------|------------|
| `false` (default) | — | **None** — site uses static fallbacks |
| `true` | No | Probes `admins` only; legacy login works; CMS content uses static fallbacks |
| `true` | Yes | Normal CMS queries, zero 404 |

**Do not set `cms.enabled: true` until the migration has been run.**

---

## Required tables (20)

`settings`, `home_slides`, `principal_message`, `updates`, `notices`, `courses`, `departments`, `faculty`, `facilities`, `placements`, `gallery`, `media_library`, `footer_blocks`, `contacts`, `admissions`, `inquiries`, `ai_knowledge_base`, `ai_prompts`, `ai_conversations`, `admins`

## Storage

Bucket: **`cms`** (public read, admin write) — created by the migration.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 404 on settings | Run `supabase/RUN_ALL_MIGRATIONS.sql` |
| Legacy login fails | Same — includes `002_admin_auth_fixes.sql` RPCs |
| 403 / permission denied | Sign in with Supabase Auth; ensure `auth_user_id` or email matches `admins` row |
| Upload fails | Verify `cms` bucket exists in Storage |
| Still 404 after migration | Run `NOTIFY pgrst, 'reload schema';` in SQL Editor (included at end of migration) |
