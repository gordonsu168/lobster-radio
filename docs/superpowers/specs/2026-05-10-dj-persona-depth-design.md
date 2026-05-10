# DJ Persona Depth Design Spec

## Overview
The goal of this feature is to make the Lobster Radio DJ sound more profound, memorable, and insightful. Instead of short, generic intros, the DJ will share "Musical Insight & History" using a hybrid of provided context (`track.explanation` / `contextSummary`) and the LLM's own internal knowledge, while speaking for a slightly longer duration (3-4 sentences).

## Requirements
1. **Length Update**: Increase the DJ script length constraint from 1-2 sentences to 3-4 sentences.
2. **Insight Generation**: The LLM must be explicitly prompted to integrate the provided track explanation/context with its own knowledge to produce profound insights.
3. **Style Differentiation**: Tailor the *type* of insight requested based on the `DJStyle` (classic, night, trivia, vibe).
4. **Fallback Enhancement**: Rewrite the hardcoded fallback templates to match the new 2-3 sentence length and include faux-deep, generic insights.

## Architecture & Implementation

### 1. Prompt Restructuring (`NarratorAgent.ts`)
- **System Prompt**: Update instructions to enforce the 3-4 sentence limit. Change "1-2句" (1-2 sentences) to "3-4句" (3-4 sentences). Add instructions that the DJ should deliver memorable, deep musical insights.
- **User Prompt**: Explicitly pass `input.track.explanation` as part of the context. Instruct the LLM: "Blend the provided track context with your own deep knowledge of the artist's history, album context, or production secrets to create a profound and memorable intro."

### 2. Style-Specific Insights (`getSystemPrompt`)
Modify the style descriptions to guide the *type* of insight generated:
- **classic**: Focuses on the artist's career trajectory, awards, and legacy.
- **night**: Focuses on lyrical meaning, emotions, and the atmospheric background of the song.
- **trivia**: Focuses on deep-cut facts, recording process, and hidden details.
- **vibe**: Focuses on the energy, production techniques, and cultural impact.

### 3. Upgraded Fallbacks (`getFallbackTemplate`)
Update the `templates` object for all languages (`zh-HK`, `zh-CN`, `en-US`):
- Increase the length of the string templates from 1 sentence to 2-3 sentences.
- Add generic but profound-sounding insights (e.g. "This track really shows how their sound evolved.", "It's amazing how this melody can capture the exact mood of the moment.").

## Error Handling & Edge Cases
- If the track has no `explanation`, the LLM will rely purely on `contextSummary` and its internal knowledge. The prompt should be robust enough to handle missing fields gracefully.
- Fallback templates are used when the LLM is unavailable or errors out, providing a safe and seamless listener experience.

## Testing
- Verify that LLM responses naturally span 3-4 sentences.
- Test with obscure tracks to ensure the hybrid prompt uses the `track.explanation` instead of hallucinating.
- Test fallback mode to ensure the new multi-sentence templates are rendered correctly.
