# AI DJ System

## Overview

The AI DJ is the heart of Lobster Radio - it generates natural-sounding narration, responds to user chat, handles skip requests, and creates mid-track trivia.

## Components

### RadioDJAgent
- **Location**: `backend/src/agents/RadioDJAgent.ts`
- **Responsibilities**:
  - Generate intro narration for a track
  - Generate outro after a track finishes
  - Generate mid-track trivia about the current playing track
  - Respond to user chat messages
  - Detect when user wants to skip the current track

### Personality System (DJ Persona Depth)
- **Location**: See **[[features/dj-persona|DJ Persona Depth]]**
- Configurable style: `classic`, `modern`, `conversational`
- Configurable emotion: `happy`, `sad`, `energetic`, `calm`, `normal`
- Configurable language: `zh-CN`, `zh-HK`, `en-US`

### Text-to-Speech
- Multiple providers supported (Edge TTS, others)
- TTS audio is cached in `backend/data/tts-cache.json` to avoid re-generating the same text twice
- Caching saves API costs and speeds up playback

## Message Flow

1. **Intro**: When new track starts → generate intro narration → TTS converts to audio → play narration → then play music
2. **Outro**: When track ends → generate outro → play on independent audio → immediately start next track → outro continues in background
3. **Mid-track Trivia**: When music reaches 30-60% → generate trivia → duck music volume → play trivia → restore volume
4. **User Chat**: User sends message → AI responds → may trigger actions (skip track, refresh recommendations)

## Design Decisions

**Why independent audio?** See **[[architecture/audio-playback|Audio Playback]]**.

**Why cache TTS?** Generating TTS takes time and costs money. The same narration text will never change, so caching is a clear win.

## Related Pages
- **[[features/radio-mode|Radio Mode]]**
- **[[features/chat-producer|Chat with Producer]]**
- **[[features/dj-persona|DJ Persona Depth]]**
