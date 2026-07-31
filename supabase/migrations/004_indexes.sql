-- Performance indexes for CMS list queries (idempotent)
create index if not exists idx_settings_display_order on public.settings (display_order);
create index if not exists idx_home_slides_published_order on public.home_slides (published, display_order);
create index if not exists idx_updates_published_order on public.updates (published, display_order);
create index if not exists idx_notices_published_order on public.notices (published, display_order);
create index if not exists idx_principal_message_published_order on public.principal_message (published, display_order);
create index if not exists idx_courses_published_order on public.courses (published, display_order);
create index if not exists idx_departments_published_order on public.departments (published, display_order);
create index if not exists idx_faculty_published_order on public.faculty (published, display_order);
create index if not exists idx_facilities_published_order on public.facilities (published, display_order);
create index if not exists idx_placements_published_order on public.placements (published, display_order);
create index if not exists idx_gallery_published_order on public.gallery (published, display_order);
create index if not exists idx_media_library_published_order on public.media_library (published, display_order);
create index if not exists idx_footer_blocks_published_order on public.footer_blocks (published, display_order);
create index if not exists idx_ai_knowledge_base_published_order on public.ai_knowledge_base (published, display_order);
create index if not exists idx_ai_prompts_published_order on public.ai_prompts (published, display_order);
create index if not exists idx_inquiries_status_created on public.inquiries (status, created_at desc);
create index if not exists idx_admissions_status_created on public.admissions (status, created_at desc);
create index if not exists idx_contacts_status_created on public.contacts (status, created_at desc);
create index if not exists idx_ai_conversations_status_created on public.ai_conversations (status, created_at desc);
create index if not exists idx_admins_email_lower on public.admins (lower(email));

notify pgrst, 'reload schema';
