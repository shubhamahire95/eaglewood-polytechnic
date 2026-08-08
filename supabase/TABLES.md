# Eaglewood CMS — Supabase Table Manifest

This document maps **every Supabase resource** used by the JavaScript app to the actual database objects.

## Required tables (queried by the app)

| User-facing name | SQL table | Used by |
|------------------|-----------|---------|
| Settings | `settings` | home, footer, contact, admin |
| Hero slides | `home_slides` | home, admin |
| Principal message | `principal_message` | home, admin |
| Updates | `updates` | home, admin |
| Important notices | `notices` | home, admin |
| Courses | `courses` | home, admission form, admin |
| Departments | `departments` | home, admin |
| Faculty | `faculty` | home, admin |
| Facilities | `facilities` | home, admin |
| Placements | `placements` | home, admin |
| Gallery | `gallery` | home, admin |
| Downloads | `downloads` | home student resources, admin |
| Media library | `media_library` | admin uploads |
| Footer blocks | `footer_blocks` | footer CMS, admin |
| Contact messages | `contacts` | contact form, admin |
| Admissions | `admissions` | admission form, admin |
| Inquiries | `inquiries` | AI unanswered + forms, admin |
| AI knowledge | `ai_knowledge_base` | AI assistant, admin |
| AI prompts | `ai_prompts` | AI assistant, admin |
| AI conversations | `ai_conversations` | AI assistant, admin |
| Admin users | `admins` | admin login, admin panel |

## Storage

| Bucket | Purpose |
|--------|---------|
| `cms` | Admin image/file uploads (hero, gallery, principal, etc.) |

## NOT queried by the app (optional / future)

These exist in legacy `schema.sql` but **must not be called** until a feature is implemented:

`visitors`, `home_sections`, `events`, `ai_analytics`, `testimonials`, `faq`, `menus`, `seo_pages`, `popups`, `newsletters`, `feedback`, `analytics_events`, `activity_logs`, `notifications`, `backups`, `hero_content`, `principal`, `ai_faqs`, `ai_settings`, `chat_logs`, `ai_categories`, `ai_questions`, `ai_training`, `ai_logs`, `ai_feedback`

## Setup

1. Run `supabase/RUN_ALL_MIGRATIONS.sql` in Supabase SQL Editor (order: 003 → 001 → 002 → 004)
2. Set `cms.enabled: true` in `assets/js/config.js`
3. Hard-refresh the site and click **Retry connection** in the admin dashboard
4. Verify: `node scripts/audit-supabase.js`

Until step 2, the public site uses static fallbacks and makes **zero** REST calls.
