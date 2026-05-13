# Memory System

## Overview

SQLite-based persistent memory for user preferences and interaction history.

## Why SQLite?

- File-based, no database server needed
- ACID compliant - safe for concurrent writes
- Embedded into the backend process
- Persists across application restarts

## Components

### MemoryAgent
- **Location**: `backend/src/agents/MemoryAgent.ts`
- Stores:
  - User likes/dislikes by track ID
  - Chat history with AI DJ
  - Preference snapshots over time

### Schema

```
likes (track_id TEXT, liked BOOLEAN, created_at TIMESTAMP)
chat_history (id INTEGER PRIMARY KEY, role TEXT, content TEXT, timestamp TIMESTAMP)
preferences (id INTEGER PRIMARY KEY, snapshot_json TEXT, created_at TIMESTAMP)
```

## Usage

- Music recommendations use the preference history to give better results
- Chat context is preserved across page refreshes
- AI DJ can refer to earlier parts of the conversation

## Storage Location

`backend/src/data/runtime/history.db` - SQLite database file (git-ignored, persists locally)

## Caching

- TTS audio cache is stored separately at `backend/data/tts-cache.json`
