# DJ Persona Depth

## Overview

Configurable personality for the AI DJ - allows the user to customize:
- DJ style (classic, modern, conversational)
- DJ emotion (happy, energetic, calm, sad, normal)
- Language (Chinese Simplified, Chinese Traditional, English)

## How It Works

The persona configuration gets injected into the LLM system prompt. The AI is instructed to adopt that personality for all responses and narrations.

**Location**: `backend/src/persona` - contains the prompt templates for different styles.

## User Configuration

User's preferences are saved in:
- `backend/src/data/runtime/preferences.json` - git-ignored, persisted locally
- Loaded on startup, updated when user changes settings

## Related Pages
- **[[architecture/ai-dj|AI DJ System]]**
