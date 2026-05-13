# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies:**
```bash
npm install
# Desktop player (optional)
cd desktop && npm install
```

**Start development (full-stack):**
```bash
npm run dev
```
Starts frontend (Vite on http://localhost:5173), backend (Express on http://localhost:4000), and agents in watch mode concurrently.

**Quick restart (fixes port conflicts):**
```bash
npm run restart
# or
./restart.sh
```

**Stop all services:**
```bash
npm run stop
# or
./stop.sh
```

**Build all workspaces:**
```bash
npm run build
```

**Type check (lint):**
```bash
npm run lint
```

**Run tests (agents only):**
```bash
npm test -w agents
```

**Start desktop floating player (macOS only):**
```bash
cd desktop && npm start
```

## Architecture Overview

Lobster Radio is an AI-driven private Cantonese (粤语) radio station. It's a **monorepo using npm workspaces** with four main packages:

### Workspaces

| Package | Purpose | Tech Stack |
|---------|---------|-----------|
| `frontend/` | React web UI | React 18 + Vite + Tailwind CSS + React Router |
| `backend/` | Express API server | Express + TypeScript + SQLite (better-sqlite3) |
| `agents/` | LangChain AI agents | LangChain + TypeScript (packaged as workspace dependency) |
| `desktop/` | Electron floating player | Electron (macOS only) |

### Backend Architecture

**Entry Point:** `backend/src/server.ts` - Creates Express app, registers all API routes, and auto-scans music library on startup.

**Key API Routes** (`backend/src/routes/`):
- `/api/recommendations` - Music recommendations
- `/api/tts` - Text-to-speech synthesis
- `/api/library` - Music library operations
- `/api/wiki` - Song wiki metadata
- `/api/chat` - Chat interactions with AI DJ
- `/api/wikipedia` - Wikipedia content fetching for trivia

**Core Services** (`backend/src/services/`):
- `ttsService.ts` - Multi-provider TTS with automatic fallback: Gemini → Mac Say → no narration
- `narrationGenerator.ts` - Generates Cantonese narration per DJ persona (four styles)
- `wikiService.ts` - Manages song wiki data with auto-import from scanned library
- `musicLibraryService.ts` - Scans local music files and extracts metadata
- `storageService.ts` - SQLite abstraction for history and preferences persistence
- `recommendationService.ts` - Generates personalized recommendations based on listening history

### Frontend Architecture

**Main Pages** (`frontend/src/pages/`):
- `HomePage.tsx` - Landing page
- `RadioModePage.tsx` - Main radio playback experience (core feature)
- `SettingsPage.tsx` - User settings and configuration
- `WikiPage.tsx` - Browse song wiki collection

**Components** (`frontend/src/components/`):
- `PlayerCard.tsx` - Main player UI
- `MiniPlayer.tsx` - Compact player for desktop mode
- `ChatPanel.tsx` - Chat interaction with AI DJ
- `HistoryPanel.tsx` - Listening history
- `TrackQueue.tsx` - Play queue display

### Key Design Points

- **DJ Persona**: Defined in `DJ_PERSONA.md` - 小龙 (Xiaolong), a thirty-something music fan that speaks authentic Cantonese
- **Four DJ Styles**: Classic (classic radio vibe), Night (calming late-night), Vibe (energetic), Trivia (knowledgeable)
- **TTS Fallback**: Automatic degradation if primary TTS provider fails - ensures radio always plays
- **Long-term Memory**: SQLite database stores listening history and user preferences for personalized recommendations
- **Auto-import**: On startup, backend scans `LOCAL_MUSIC_PATH` and auto-imports tracks into the wiki database

## Environment Variables

See `.env.example` for the full list. Required:
- `GEMINI_API_KEY` - For high-quality Cantonese TTS (recommended)
- `LOCAL_MUSIC_PATH` - Path to your local music folder
