# Wiki Change Log

Chronological record of all wiki updates following LLM-Wiki principles.

## 2026-05-13 - Initial Wiki Creation

- Create initial wiki structure per Karpathy LLM-Wiki idea
- Add all core architecture and feature pages
- Capture the current state after the narration decoupling refactor

## 2026-05-13 - Code Simplification

- Remove duplicate audio processing code, extract to `audioUtils.ts`
- Simplify `NarrationInstance` to just `HTMLAudioElement[]`
- Fix duplicate `loadMoreRecommendations` calls
- Fix stale closure in `ChatPanel`
- Add volume sync for narration audio

Updates:
- [[architecture/audio-playback]] - updated with new decoupled design
