# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Remembry** is an AI-powered meeting notes application that transforms audio recordings into structured, searchable notes. Built with Next.js 16 (App Router), it uses Gemini AI for transcription and extraction, and Supabase for storage and semantic search.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (Radix UI)
- **AI**: Google Gemini 3 Flash (`gemini-3-flash-preview`) via `@google/genai`
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS + CSS variables (no `tailwind.config.js` - configured via CSS)

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint      # Run ESLint
```

## Architecture

### AI Processing Pipeline (`src/lib/gemini.ts`)

All AI operations use the same `TRANSCRIPTION_MODEL = "gemini-3-flash-preview"`:
- **Transcription**: `transcribeAudio()` - uploads audio to Gemini Files API, polls for processing, then transcribes
- **Notes Extraction**: `extractMeetingNotes()` - generates structured JSON with summary, action items, decisions, Q&A
- **Retry Logic**: Both functions use `retryWithBackoff()` with exponential backoff for rate limits (429), network errors, and 500s

### File Search / RAG (`src/lib/fileSearch.ts`)

Uses Supabase as a document store with simple keyword-based retrieval (not vector search):
- `retrieveChunks()` - tokenizes query, scores document chunks by term frequency, returns top 12 matches
- `fileSearch()` - retrieves chunks then uses Gemini to synthesize an answer from context
- `listAllRagStores()` / `listAllProjects()` - list available projects/stores
- Project IDs use format `project_{uuid}`; document IDs use format `documents/{uuid}`

### Supabase Client (`src/lib/supabase.ts`)

Server-side only. Uses `SUPABASE_SERVICE_ROLE_KEY` for API routes. Tables: `projects`, `project_documents`, `meetings`, `user_gemini_keys`.

### API Routes Pattern

API routes in `src/app/api/` follow Next.js App Router conventions. Key patterns:
- User API keys stored in `user_gemini_keys` table, fetched per-request via `src/lib/userKey.ts`
- File uploads saved to `/uploads` directory temporarily, then processed
- Meeting audio files are NOT stored - transcription JSON is stored in `meetings.notes_by_language`

### Meetings Flow

1. Upload audio → `POST /api/meetings/upload` - saves file, starts transcription
2. Analyze/Extract → `POST /api/meetings/analyze` - runs transcription + extraction
3. View Notes → `GET /api/meetings/[id]/extract` - retrieves extracted notes
4. Regenerate → `POST /api/meetings/[id]/regenerate-notes` - re-runs extraction with different language

### Search System

Multi-store search (`src/app/api/search/multi-store/route.ts`):
- Queries multiple projects in parallel using `Promise.all`
- Per-store timeout (default 30s) prevents slow stores from blocking
- Aggregates results then synthesizes via Gemini

## Local Development

### Supabase CLI Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Get keys with: supabase status
# Default: http://127.0.0.1:54321

# Run migrations
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
```

### Environment Variables

```env
SUPABASE_URL=http://127.0.0.1:54321        # Local Supabase
SUPABASE_SERVICE_ROLE_KEY=<your-key>       # From `supabase status`
GEMINI_API_KEY=                            # Optional server-side fallback
```

Users save their personal Gemini API key via `/settings` page (stored in `user_gemini_keys` table).

## Database Schema

Core tables:
- `projects` - id, display_name, color, created_at
- `project_documents` - id, project_id, display_name, mime_type, content, metadata, created_at
- `meetings` - id, project_id, title, context, file_name, transcription (JSONB), notes_by_language (JSONB), default_language
- `user_gemini_keys` - user_id, gemini_api_key

Supabase RLS is enabled. Permissive policies are set to `using (true) with check (true)` for development.
