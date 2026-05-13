# Audio Playback Architecture

## Overview

We have two types of audio playback:

1. **Music**: One dedicated `HTMLAudioElement` for the current track. This is what the user primarily listens to.
2. **Narrations**: Every narration (intro, outro, mid-track trivia) gets its own independent `HTMLAudioElement`.

**Why independent?** The whole point of the refactor in [55bb9f2f](https://github.com/gordonsu168/lobster-radio/commit/55bb9f2f) was that when you skip a track, any currently-playing outro/narration should continue playing uninterrupted. Only the music changes immediately.

## Architecture

### Music Playback
- Single `<audio>` element in `RadioModePage.tsx` referenced by `audioRef`
- Volume is controlled globally by this element
- When switching tracks: `src` is updated, `load()` and `play()` are called

### Narration Playback
- Each narration creates a new `HTMLAudioElement`
- All active narrations are tracked in `activeNarrationsRef` (array of `HTMLAudioElement`)
- When narration completes (or errors), it's cleaned up:
  - `pause()` is called
  - Removed from tracking array
  - `URL.revokeObjectURL()` releases the blob URL
- **Volume sync**: When a narration starts, it inherits the current volume from the main music audio
- **Play/Pause sync**: When user toggles play/pause, *all* active narrations are also paused/resumed alongside music

### Shared Utilities

All narration audio creation/cleanup is now extracted to `frontend/src/lib/audioUtils.ts`:

- `createNarrationAudio()` - converts base64 audio from TTS to blob URL, creates audio element, sets up event handlers
- `cleanupNarrationAudio()` - cleans up resources after playback

## Key Behaviors

### Outro
- After a track ends, we generate the outro narration
- Start outro on independent audio
- **Immediately** start playing next track (with its intro)
- Outro continues playing in background overlapping slightly - this sounds natural!

### Mid-Track Trivia
- When music playback reaches ~30-60% duration, we trigger trivia generation
- Lower main music volume to ~25%
- Play trivia on independent audio
- When trivia completes, restore main music volume

### Skip Request
- When user clicks "Skip" or AI requests skip:
  - Immediately stop music
  - *Leave any current narrations playing*
  - Start next track immediately

## Why This Design

**Before**: Narration shared the same audio element as music. Skipping or switching tracks would abruptly cut off any outro/narration. Users felt this was unnatural - the DJ talking while the next song starts is part of the experience of real radio.

**After**: Narrations outlive the track they're about.切歌不会打断旁白，符合真实电台的感觉。

## Entry Points

- `frontend/src/pages/RadioModePage.tsx` - Main component orchestrating playback
- `frontend/src/lib/audioUtils.ts` - Shared narration audio utilities
- `frontend/src/hooks/useAudioPlayer.ts` - Hook for main music audio (not used for narrations currently)
