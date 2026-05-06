-- Remembry Database Schema
-- Run this in Supabase SQL Editor (local or cloud)

-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================
create table if not exists public.projects (
  id text primary key,
  display_name text not null,
  color text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- PROJECT DOCUMENTS TABLE
-- =============================================================================
create table if not exists public.project_documents (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  display_name text not null,
  mime_type text,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- MEETINGS TABLE
-- =============================================================================
create table if not exists public.meetings (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  context text,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text,
  file_type text not null default 'audio',
  created_at timestamptz not null default now(),
  transcription jsonb not null,
  notes_by_language jsonb not null default '{}'::jsonb,
  default_language text not null default 'en',
  available_languages text[] not null default array['en']
);

-- =============================================================================
-- USER GEMINI KEYS TABLE
-- =============================================================================
create table if not exists public.user_gemini_keys (
  user_id text primary key,
  gemini_api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used timestamptz,
  usage_count bigint not null default 0
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_meetings_project_id on public.meetings(project_id);
create index if not exists idx_meetings_created_at on public.meetings(created_at desc);

-- =============================================================================
-- ROW LEVEL SECURITY (permissive for development)
-- =============================================================================
alter table public.projects enable row level security;
alter table public.project_documents enable row level security;
alter table public.meetings enable row level security;
alter table public.user_gemini_keys enable row level security;

-- Permissive policies for development
create policy "projects_all" on public.projects for all using (true) with check (true);
create policy "project_documents_all" on public.project_documents for all using (true) with check (true);
create policy "meetings_all" on public.meetings for all using (true) with check (true);
create policy "user_gemini_keys_all" on public.user_gemini_keys for all using (true) with check (true);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to increment usage count
create or replace function public.increment_usage_count(p_user_id text)
returns void as $$
begin
  update public.user_gemini_keys
  set usage_count = usage_count + 1, last_used = now()
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;
