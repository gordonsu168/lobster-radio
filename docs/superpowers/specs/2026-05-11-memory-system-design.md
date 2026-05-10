# Memory System Design Spec

## Overview
The goal of this feature is to implement a memory system that allows the Lobster Radio DJ to better understand the user's behavior. We will use a "Rule-Based Summarizer" approach to aggregate the user's raw playback preferences into two text summaries: Short-Term Memory (the current session's behavior) and Long-Term Memory (lifetime affinities). These summaries will be injected directly into the `NarratorAgent`'s prompt to enable personalized commentary.

## Requirements
1. **Memory Utilities**: Provide a deterministic way to process the `Preferences` object into clean text summaries for both short-term and long-term memory.
2. **Short-Term Memory**: Aggregate the user's `history` over the last 12 hours. It must report the total number of songs listened to today, the number of dislikes/skips, and any emerging patterns.
3. **Long-Term Memory**: Aggregate the user's entire `history`, `likes`, and `dislikes` to determine their top 2 favorite artists and their primary `moodAffinity`.
4. **Narrator Integration**: Update `NarratorAgent` to accept the memory strings and update its prompt to instruct the DJ to personalize its commentary using this context.

## Architecture & Implementation

### 1. Memory Summarizer Utility (`backend/src/services/memoryService.ts` or equivalent)
Since the `Preferences` type is defined in the `agents` workspace (in `agents/src/types.ts`) and also used by the backend, we should create a utility function `MemorySummarizer.ts` within the `agents` workspace (e.g., `agents/src/lib/MemorySummarizer.ts`) so it can be easily used alongside `NarratorAgent`.

- `getShortTermMemory(prefs: Preferences): string`
  - Filters `history` for items with `playedAt` within the last 12 hours.
  - Counts total items and counts items with `feedback === "dislike"`.
  - Returns a string, e.g., "User listened to 5 songs today and skipped 2. The current session has been mixed."
- `getLongTermMemory(prefs: Preferences): string`
  - Counts artist frequencies across the entire `history` and `likes`.
  - Determines the highest value in `moodAffinity`.
  - Returns a string, e.g., "User's favorite artists include [Artist A] and [Artist B]. Their primary mood affinity is [Mood]."

### 2. Narrator Integration (`agents/src/agents/NarratorAgent.ts`)
- **Type Update**: Update the `NarratorInput` interface to include optional `shortTermMemory?: string` and `longTermMemory?: string`.
- **Prompt Update**: In `getUserPrompt`, inject the memory fields if they are provided.
- **Instruction**: Append an instruction to the prompt (across all languages) directing the LLM: "Use the provided Short-Term and Long-Term memory context to make your commentary more personalized. For example, if they skipped a lot today, mention a change of pace; if playing a favorite artist, acknowledge it."

## Error Handling & Edge Cases
- If the user has no history (new user), the memory functions should return an empty string or a safe default ("No previous listening data available").
- The prompt logic must be robust to missing memory fields so that the DJ falls back to generic commentary seamlessly.

## Testing
- Unit tests for `MemorySummarizer.ts` covering empty history, short-term history extraction, and long-term artist aggregation.
- Unit tests for `NarratorAgent.ts` ensuring the new memory fields are correctly injected into the user prompt.