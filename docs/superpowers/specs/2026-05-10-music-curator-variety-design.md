# Music Curator Algorithm Variety Design
**Date**: 2026-05-10
**Context**: The `MusicCuratorAgent` current algorithm returns the exact same tracks on identical inputs because it relies on a deterministic sort (likes, dislikes, energy). We need to introduce variety while respecting user preferences.

## 1. Approach
Move from a chained deterministic sort to a point-based scoring system. This allows multiple factors (preferences, history, energy, and randomness) to composite together into a final score for each track.

## 2. Scoring Components
For each candidate track, we calculate a `score` starting at 0:

- **Likes & Dislikes**:
  - `preferences.likes.includes(track.id)`: +100 points
  - `preferences.dislikes.includes(track.id)`: -100 points
- **Energy**:
  - Add `track.energy` (assuming it's a normalized value, maybe multiply by a small factor if needed, but adding it directly is fine as a baseline).
- **History Penalty**:
  - If `preferences.history.some(h => h.id === track.id)`: -50 points
  - This ensures recently played songs drop in ranking without being completely removed.
- **Randomness**:
  - Add `Math.random() * 10` to the score. This breaks ties and shuffles tracks that have similar base scores.

## 3. Algorithm Flow
1. **Filter**: Remove duplicates and garbled titles (existing logic).
2. **Score**: Calculate the score for each track using the components above.
3. **Sort**: Sort all tracks by `score` in descending order.
4. **Slice**: Take the top 20 tracks.
5. **Map**: Append the context explanation (existing logic).