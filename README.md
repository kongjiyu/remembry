# Remembry - AI Meeting Notes

> **Version:** 1.0  
> **Status:** In Development

An intelligent platform that transforms meeting recordings into structured, actionable meeting notes. Powered by Gemini AI for transcription, intelligent extraction, and semantic search.

## 🎯 Vision

Automatically convert meeting recordings into comprehensive notes with:
- **Accurate transcription** with speaker diarization
- **Smart extraction** of decisions, action items, and Q&A pairs
- **Multi-language support** for meeting notes output
- **Semantic search** across all your meetings

## 🔄 Core User Flow

```
Record/Upload Audio → Transcription (Speaker Diarization) → AI Processing (Gemini 3)
       ↓                                                              ↓
   Save to RAG ←────────────── Meeting Notes + Tasks (Markdown)
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** React Context
- **File Upload:** Native file input + drag-and-drop

### Backend
- **Framework:** Next.js API Routes
- **Storage:** Local file system (uploads/)

### AI & Services
- **Transcription:** Gemini 3 Flash (with auto-chunking for long files)
- **AI Processing:** Gemini 3 Flash/Pro (structured output extraction)
- **RAG Search:** Vertex AI RAG Store (semantic search across meetings)

## 📋 Key Features

### Module 1: Audio Ingestion
- Upload audio files (MP3, WAV, M4A, WebM, MP4)
- **In-browser audio recording** with microphone access
  - Start/stop/pause/resume recording controls
  - Real-time duration display
  - Audio playback preview before submission
- Meeting metadata input (title, project, notes)
- Upload progress indicator
- Audio file validation (size, format)

### Module 2: Transcription
- Automatic transcription using **Gemini 3 Flash**
- **Audio chunking** for large files
- Multi-speaker diarization
- Multi-language support
- Real-time processing status updates

### Module 3: AI Extraction
- Generate meeting summary
- Extract decisions made
- Extract action items
- Extract Q&A pairs
- Extract key topics and assumptions
- **Multi-language notes output** - generate notes in multiple languages simultaneously

### Module 4: RAG Search (Vertex AI)
- Semantic search across all meetings
- "When did we decide X?" queries with source citations
- Project-based organization
- Deep links to meeting details

### Module 5: Projects
- Organize meetings by project
- Each project has its own RAG store
- Project-level search and analytics

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Google Cloud account (for Gemini API and Vertex AI)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Variables

```bash
# Google Cloud / Gemini
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Authentication (optional)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

## 📁 Project Structure

```
remembry/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   │   ├── meetings/       # Meeting CRUD and upload
│   │   │   ├── projects/       # Project management
│   │   │   ├── search/         # Search API
│   │   │   └── ask/            # AI Q&A endpoint
│   │   ├── dashboard/          # Dashboard view
│   │   ├── meetings/           # Meeting list and details
│   │   │   ├── new/            # Upload new meeting
│   │   │   └── [id]/           # Meeting detail view
│   │   ├── projects/           # Project management
│   │   ├── search/             # Search across meetings
│   │   └── settings/           # App settings
│   ├── components/
│   │   ├── layout/             # Layout components (sidebar, dashboard)
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions (gemini.ts, fileSearch.ts)
├── uploads/                    # Local meeting storage
├── public/                     # Static assets
└── package.json
```

## 🎯 Development Roadmap

### Phase 1: MVP (Current)
- [x] Frontend: Basic UI with meeting upload
- [x] Backend: Audio transcription with Gemini
- [x] AI extraction of meeting notes
- [x] Multi-language notes support
- [x] Basic meeting list and details view
- [x] Project-based organization
- [x] RAG-based semantic search

### Phase 2: Enhanced Features
- [ ] Advanced analytics and insights
- [ ] Action item tracking and notifications
- [ ] Improved speaker diarization
- [ ] Meeting templates
- [ ] Team collaboration features
