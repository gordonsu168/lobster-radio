# Radio Mode

Radio Mode is the core feature of Lobster Radio - an infinite, continuous AI-powered radio stream.

## How It Works

- Never-ending queue: When the queue gets low, we automatically prefetch more recommendations in background
- DJ narrations: Every track gets a personalized intro from the AI DJ
- Outro chatter: After the track ends, the DJ gives some closing comments while the next track starts
- Mid-track trivia: During the song, the DJ may interject with an interesting trivia fact about the artist or track
- User control: User can like/dislike tracks, skip tracks, pause/play, and chat with the DJ

## Entry Point
- `frontend/src/pages/RadioModePage.tsx` - React component that implements the entire radio flow
- See **[[architecture/audio-playback|Audio Playback]]** for details on the decoupled narration architecture.

## Key States

- `queue` - array of upcoming tracks waiting to play
- `currentTrack` - the currently playing track
- `isPlaying` - whether music is currently playing
- `currentNarration` - text of the current track intro
- `currentOutro` - text of the track outro
- `currentTrivia` - text of the active mid-track trivia

## Key Algorithms

### Preloading Strategy
- When queue has <3 tracks left, preload more recommendations in background
- This ensures the queue never runs dry and there's minimal waiting

### Skip Flow
1. User clicks "Skip" or AI requests skip via chat
2. Music stops immediately
3. Any active narrations (outro/trivia) continue playing
4. Next track starts immediately with new intro

Related: **[[architecture/ai-dj|AI DJ System]]**, **[[features/chat-producer|Chat with Producer]]**
