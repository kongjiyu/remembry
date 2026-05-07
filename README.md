<p align="center">
    <img src="./public/logo.svg" alt="Remembry" width="120" />
</p>

<p align="center">
    <img alt="Typing animation" src="https://readme-typing-svg.demolab.com?font=Avenir&weight=700&size=24&duration=2200&pause=900&color=8B5CF6&center=true&vCenter=true&width=780&lines=AI-Powered+Meeting+Notes;Transform+Recordings+into+Structured+Notes;Search+Across+All+Your+Meetings">
</p>

<p align="center">
    <a href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" style="margin:2px 4px;"></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" style="margin:2px 4px;"></a>
    <a href="https://supabase.com/"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-Local-3ECF8E?logo=supabase&logoColor=white" style="margin:2px 4px;"></a>
    <a href="https://ai.google.dev/"><img alt="Gemini" src="https://img.shields.io/badge/Gemini-3+Flash-92003B?logo=google&logoColor=white" style="margin:2px 4px;"></a>
    <img alt="Self-hosted" src="https://img.shields.io/badge/Deploy-Self--hosted-FF6B6B?style=margin:2px 4px;">
    <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=margin:2px 4px;">
</p>

<p align="center">
    <strong>Remembry</strong> is a self-hosted AI-powered meeting notes application. Install it on your own computer, and access it through your browser. All your data stays local — no cloud dependencies, no subscriptions.
</p>

---

## Features

- **Audio Recording** — Record directly in browser with microphone support
- **File Upload** — Upload MP3, WAV, M4A, WebM, or MP4 files
- **AI Transcription** — Automatic transcription with speaker diarization
- **Smart Extraction** — Extract decisions, action items, and Q&A pairs
- **Multi-language Notes** — Generate notes in 12+ languages
- **Semantic Search** — Ask questions like "When did we decide X?"
- **Project Organization** — Organize meetings by project or client

---

## Screenshots

### Dashboard & Navigation

| Page | Preview |
|------|---------|
| **Dashboard** | ![Dashboard](./public/01-home.png) |
| **Meetings List** | ![Meetings](./public/02-meetings.png) |
| **Upload Meeting** | ![New Meeting](./public/03-new-meeting.png) |
| **Settings** | ![Settings](./public/04-settings.png) |

### User Guide

See [User Guide](#user-guide) below for step-by-step instructions.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| AI | Google Gemini 3 Flash |
| Database | Supabase (local) |
| Styling | Tailwind CSS + CSS variables |

---

## Quick Start

### Prerequisites

- Node.js 18.0.0 or later
- Supabase CLI
- Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/kongjiyu/remembry.git
cd remembry

# 2. Install dependencies
npm install

# 3. Start local Supabase
supabase start

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase values

# 5. Initialize database
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql

# 6. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Settings** to enter your Gemini API key.

---

## User Guide

Transform your meeting recordings into structured notes in 4 simple steps:

### Step 1: Enter Your API Key

Before using Remembry, you need to configure your Gemini API key:

1. Go to **Settings** from the sidebar
2. Enter your API key (get one free at [Google AI Studio](https://aistudio.google.com/app/apikey))
3. Click **Save**

![Settings](./public/04-settings.png)

---

### Step 2: Create a Project

Organize your meetings by project:

1. Click **New Project** on the Dashboard
2. Enter a project name (e.g., "Team Meeting", "Client Call")
3. Choose a color for easy identification
4. Click **Create**

---

### Step 3: Upload Recording

Upload your meeting audio or video file:

1. Click **Upload** on the sidebar or Dashboard
2. Select your project from the dropdown
3. Enter a title for your meeting
4. Drag & drop or click to select your audio file (MP3, WAV, M4A, WebM, MP4)
5. Click **Upload Recording**

![Upload](./public/03-new-meeting.png)

---

### Step 4: View Your Meeting Notes

Once processed, view your AI-generated meeting notes:

1. Go to **Meetings** from the sidebar
2. Click on your meeting card
3. Switch between **Meeting Notes** and **Transcript** tabs
4. Use the language selector to view notes in different languages

![Meeting Detail](./public/06-meeting-detail.png)

The Meeting Notes tab shows:
- **Summary** — Quick overview of the meeting
- **Action Items** — Tasks assigned during the meeting
- **Decisions** — Key decisions made
- **Q&A** — Questions and answers from the meeting

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Record or  │────▶│ Transcribe  │────▶│  Extract    │────▶│   Store     │
│   Upload    │     │  (Gemini 3) │     │  (Gemini 3) │     │ (Supabase)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Project Structure

```
remembry/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── meetings/       # Meeting CRUD, upload, analyze
│   │   │   ├── projects/       # Project management
│   │   │   └── settings/       # Settings API
│   │   ├── dashboard/           # Dashboard page
│   │   ├── meetings/           # Meeting pages
│   │   ├── projects/           # Project pages
│   │   └── settings/           # App settings
│   ├── components/
│   │   ├── layout/             # Sidebar, breadcrumbs
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── gemini.ts           # AI transcription & extraction
│       ├── fileSearch.ts       # RAG search
│       └── supabase.ts         # Database client
├── supabase/
│   └── migrations/             # Database schema
├── public/                     # Static assets & screenshots
└── package.json
```

---

## FAQ

**Do I need a Gemini API key?**
Yes, but Google offers a generous free tier. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get started.

**Where is my data stored?**
All data is stored in your local Supabase instance. Your meeting recordings and notes never leave your computer.

**How is this different from cloud services?**
Remembry is self-hosted. You install and run it on your own hardware — complete data privacy, no subscription fees, no internet connection required.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
