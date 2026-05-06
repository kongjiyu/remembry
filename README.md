# Remembry - AI Meeting Notes

> Transform your meeting recordings into structured, actionable notes with AI.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Remembry is a **self-hosted** AI-powered meeting notes application. Install it on your own computer, and access it through your browser. All your data stays local - no cloud dependencies, no subscriptions.

## Features

### Recording & Transcription
- **Audio Recording** - Record directly in browser with microphone
- **File Upload** - Upload MP3, WAV, M4A, WebM, or MP4 files
- **Speaker Diarization** - Automatic speaker identification
- **Multi-language Support** - Works with recordings in any language

### AI-Powered Notes
- **Smart Extraction** - Automatically extract decisions, action items, and Q&A
- **Multi-language Notes** - Generate notes in 12+ languages simultaneously
- **Summary Generation** - Concise meeting summaries with key topics

### Organization
- **Project-based** - Organize meetings by project or client
- **Semantic Search** - Ask questions like "When did we decide X?"
- **Meeting History** - Keep track of all your meetings

## Screenshots

| Home | Meetings |
|:---:|:---:|
| ![Home](./public/01-home.png) | ![Meetings](./public/02-meetings.png) |

| New Meeting | Settings |
|:---:|:---:|
| ![New Meeting](./public/03-new-meeting.png) | ![Settings](./public/04-settings.png) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| AI | Google Gemini 3 Flash |
| Database | Supabase (local) |
| File Processing | Native browser APIs |

## Installation

### Prerequisites

- **Node.js** 18.0.0 or later
- **npm** or **pnpm**
- **Supabase CLI** (for local database)
- **Gemini API Key** (free tier available)

### Step 1: Clone the Repository

```bash
git clone https://github.com/kongjiyu/remembry.git
cd remembry
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Supabase (Local Database)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Start local Supabase
supabase start

# Get your keys (shown in output)
# Default: http://127.0.0.1:54321
```

### Step 4: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase values:

```env
# Supabase Local (from `supabase status`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 5: Initialize Database

Run the SQL migration in Supabase SQL Editor:

```sql
-- Paste the contents of supabase/migrations/001_initial_schema.sql
-- Or run via psql:
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
```

### Step 6: Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 7: Configure API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get a free Gemini API key
2. Go to **Settings** in Remembry
3. Enter your API key and click **Save**

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Record or  │────▶│ Transcribe  │────▶│  Extract    │────▶│   Store     │
│   Upload    │     │  (Gemini 3) │     │  (Gemini 3) │     │ (Supabase)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Ask Your   │
                                        │  Meetings   │
                                        └─────────────┘
```

## Project Structure

```
remembry/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── meetings/       # Meeting CRUD, upload, analyze
│   │   │   ├── projects/       # Project management
│   │   │   └── settings/       # Settings API
│   │   ├── meetings/           # Meeting pages
│   │   │   ├── new/            # Upload new meeting
│   │   │   └── [id]/           # Meeting detail view
│   │   ├── projects/           # Project management
│   │   └── settings/           # App settings
│   ├── components/
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions
│       ├── gemini.ts           # AI transcription & extraction
│       ├── fileSearch.ts       # RAG search
│       └── supabase.ts         # Database client
├── supabase/
│   └── migrations/            # Database schema
├── public/                     # Static assets & screenshots
└── package.json
```

## Database Schema

Remembry uses Supabase PostgreSQL with the following tables:

| Table | Description |
|-------|-------------|
| `projects` | Project/organization container |
| `meetings` | Meeting records with transcription & notes |
| `project_documents` | Document storage for RAG search |
| `user_gemini_keys` | User's Gemini API key storage |

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## FAQ

### Do I need a Gemini API key?

Yes, but Google offers a generous free tier. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get started.

### Where is my data stored?

All data is stored in your local Supabase instance. Your meeting recordings and notes never leave your computer.

### How is this different from cloud services?

Remembry is **self-hosted**. You install and run it on your own hardware. This gives you:
- Complete data privacy
- No subscription fees
- No internet connection required
- Full control over your data

## License

This project is open source under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
