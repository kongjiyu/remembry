# Remembry - AI Meeting Notes to Notion

> **Version:** 1.0  
> **Status:** In Development

An intelligent platform that transforms meeting recordings into structured, actionable meeting notes automatically synced to Notion. Powered by Gemini AI for transcription, intelligent extraction, and semantic search.

## 🎯 Vision

Automatically convert meeting recordings into comprehensive notes with:
- **Accurate transcription** with speaker diarization
- **Smart extraction** of decisions, action items, and Q&A pairs
- **Automatic Notion sync** to your workspace
- **Semantic search** across all your meetings

## 🔄 Core User Flow

```
Record/Upload Audio → Transcription (Speaker Diarization) → AI Processing (Gemini 3)
       ↓                                                              ↓
   Save to RAG ← Meeting Notes + Tasks (Markdown) → Sync to Notion
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand or React Context
- **Authentication:** Auth.js (NextAuth.js v5)
- **File Upload:** react-dropzone + presigned URLs

### Backend
- **Framework:** Node.js + Express or NestJS
- **Database:** Google Firestore
- **Queue/Jobs:** BullMQ (Redis) or Cloud Tasks
- **Deployment:** Google Cloud Run
- **Storage:** Google Cloud Storage

### AI & Services
- **Transcription:** Gemini 3 Flash (with auto-chunking for long files)
- **AI Processing:** Gemini 3 Flash/Pro (structured output extraction)
- **RAG Search:** Gemini File Search (semantic search across meetings)
- **Integrations:** Notion API via OAuth 2.0

## 📋 Key Features

### Module 1: Authentication & User Management
- User registration/login via email or OAuth (Google)
- Notion OAuth integration (connect workspace)
- User profile management
- Workspace/team support (future)

### Module 2: Audio Ingestion
- Upload audio files (MP3, WAV, M4A, WebM)
- **In-browser audio recording** with microphone access
  - Start/stop/pause/resume recording controls
  - Real-time duration display
  - Audio playback preview before submission
  - Supported browsers: Chrome, Firefox, Edge (Safari with limitations)
- Meeting metadata input (title, date, participants)
- Upload progress indicator
- Audio file validation (size, format, duration)

### Module 3: Transcription
- Automatic transcription using **Gemini 3 Flash**
- **Audio chunking** for large files (>10MB split into 10-min segments)
- Multi-speaker diarization with name detection
- Multi-language support with auto-translation
- Important word/phrase highlighting
- Real-time processing status updates

### Module 4: AI Extraction
- Generate meeting summary
- Extract decisions made (with context and decision-maker)
- Extract action items (with owners and due dates)
- Extract Q&A pairs (who asked, who answered)
- Speaker-to-participant mapping
- Validation layer before Notion sync

### Module 5: Notion Sync
- OAuth connection to Notion workspace
- Database discovery (Meeting Notes / Tasks DBs)
- Create meeting note pages
- Append content blocks (chunked for rate limits)
- Create/update task items
- Rate limiting (max 3 req/sec) with retry logic

### Module 6: RAG Search (Gemini File Search)
- Semantic search across all meetings
- "When did we decide X?" queries with source citations
- "What are my overdue action items?" queries
- Deep links to Notion pages in responses
- No separate vector database needed

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Google Cloud account (for Gemini API, Firestore, Cloud Storage)
- Notion account with API access

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
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GEMINI_API_KEY=your-gemini-api-key

# Notion
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379
```

## 📁 Project Structure

```
remembry/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Dashboard view
│   │   ├── meetings/           # Meeting list and details
│   │   │   └── new/            # Upload new meeting
│   │   ├── search/             # Search across meetings
│   │   └── settings/           # Settings and integrations
│   │       └── notion/         # Notion connection
│   ├── components/
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions
├── public/                     # Static assets
└── package.json
```

## 📚 Reference Implementations

- **Transcription Pattern:** See `testTranscript/src/components/GeminiTranscript.tsx` for working audio chunking implementation
- **Notion Integration:** See `testNotion/` for Notion API examples

## 🎯 Development Roadmap

### Phase 1: MVP (Current)
- [ ] Frontend: Basic UI with meeting upload
- [ ] Backend: Audio transcription with Gemini
- [ ] AI extraction of meeting notes
- [ ] Notion OAuth integration
- [ ] Basic meeting list and details view

### Phase 2: Enhanced Features
- [ ] Advanced search with Gemini File Search
- [ ] Action item tracking and notifications
- [ ] Multi-language support with translation
- [ ] Improved speaker diarization
- [ ] Meeting templates

### Phase 3: Team Features
- [ ] Workspace/team support
- [ ] Shared meetings and notes
- [ ] Role-based access control
- [ ] Analytics and insights

## 🤝 Contributing

This is a hackathon project. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

This project is part of the Gemini Hackathon.

## 🔗 Links

- [Project Planning Document](../planning.md) - Detailed technical specifications
- [Notion API Documentation](https://developers.notion.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Next.js Documentation](https://nextjs.org/docs)
