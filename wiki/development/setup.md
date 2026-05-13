# Local Setup

## Prerequisites

- Node.js 18+
- npm or yarn
- API keys for:
  - Music recommendation service
  - LLM provider (OpenAI compatible)
  - TTS provider

## Installation

```bash
git clone <repo>
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your API keys:

```
OPENAI_API_KEY=your_key
MUSIC_API_KEY=your_key
...
```

## Running

```bash
# Start backend
cd backend
npm install
npm run dev

# Start frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Database

The SQLite database is created automatically on first run. No migration needed.
