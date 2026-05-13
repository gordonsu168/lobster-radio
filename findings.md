# Findings & Decisions

## Requirements
<!-- Captured from user request -->
- Analyze the Lobster Radio codebase
- Create CLAUDE.md file with:
  - Common development commands (build, lint, run tests)
  - High-level code architecture and structure
- Start with the exact required text prefix
- Do not include obvious/generic instructions
- Do not make up information; only include what's actually found
- Include important parts from README.md if it exists

## Research Findings
<!-- Key discoveries during exploration -->
- **Project**: Lobster Radio (龙虾电台) - AI-driven private Cantonese (粤语) radio station
- **Tech Stack**: Full-stack TypeScript monorepo with npm workspaces
  - Frontend: React + Vite + Tailwind CSS
  - Backend: Express.js + TypeScript
  - Agents: LangChain for AI DJ functionality
  - Desktop: Electron floating player (macOS only)
  - Database: SQLite for persistent memory/history
- **Key Features**:
  - Cantonese AI narration with multiple TTS providers (Gemini, Mac Say, OpenAI, ElevenLabs)
  - Four DJ styles (Classic, Night, Vibe, Trivia) with defined persona in `DJ_PERSONA.md`
  - Local music library scanning with automatic Wiki track information
  - AI DJ with long-term memory (SQLite存储听歌历史与偏好学习)
  - Electron floating desktop player (always on top)
  - Automatic TTS fallback degradation mechanism
- **Project Structure (npm workspaces)**:
  - `frontend/` - React web UI
  - `backend/` - Express API server
  - `agents/` - LangChain AI agents (packaged as workspace dependency)
  - `desktop/` - Electron floating desktop player
- **Build System**: Uses TypeScript compilation, no monorepo build tool like turborepo
- **Linting**: Only TypeScript type checking (`tsc --noEmit`), no ESLint
- **Key Services (backend)**:
  - `ttsService.ts` - Text-to-speech synthesis with multiple providers + fallback
  - `narrationGenerator.ts` - Cantonese narration generation based on DJ persona
  - `wikiService.ts` - Song Wiki repository with track metadata and trivia
  - `musicLibraryService.ts` - Local music library scanning
  - `recommendationService.ts` - Music recommendations based on preferences
  - `storageService.ts` - SQLite persistence for history/memory
- **Key Frontend Pages**:
  - `HomePage.tsx` - Homepage
  - `RadioModePage.tsx` - Main radio experience (currently being actively developed)
  - `SettingsPage.tsx` - Settings configuration
  - `WikiPage.tsx` - Song wiki browsing
- **Commands**: All commands run from root via npm workspaces
- **Ports**: Frontend 5173, Backend 4000
