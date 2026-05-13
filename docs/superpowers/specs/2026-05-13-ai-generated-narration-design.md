# AI Generated Narration - Design Spec

## Overview

Replace the current template-based narration generation with LLM-based AI generation to create more natural, varied, and personalized DJ introductions that match the DJ persona defined in `DJ_PERSONA.md`.

## Problem Statement

The current template-based approach (`narrationGenerator.ts`) uses fixed phrase lists that get randomly combined. While it works, users report the output feels "单调" (monotonic/repetitive) because the number of combinations is limited and patterns become noticeable after listening for a while.

## Solution Design

### Architecture

We'll add a new `AINarrationService.ts` that handles LLM generation, while keeping the existing `narrationGenerator.ts` as a fallback fallback. This ensures:

- Backward compatibility
- Reliability (if LLM fails, we still have narration)
- User configurable toggle

```
API Route (wikiRoutes.ts)
  ↓
[config check] → AINarrationService.generate()
              ↓ fallback on failure
                narationGenerator (existing)
```

### Components

#### 1. `AINarrationService.ts` (new file)

Location: `backend/src/services/AINarrationService.ts`

Responsibilities:
- Build prompt from song metadata, DJ style, and context
- Call LLM (using project's existing LangChain/Gemini setup)
- Validate and truncate output to conform to DJ persona constraints
- Return generated narration text

Public API:
```typescript
export async function generateAINarration(
  song: SongWiki,
  style: DJStyle,
  context?: NarrationContext
): Promise<string>;
```

Where `NarrationContext` includes:
- `timeSegment`: morning|afternoon|night|weekend (already computed by existing `getTimeSegment()`)
- `userHistorySummary`: optional summary of recent listening for personalization

#### 2. Prompt Engineering

**System Prompt:** defines DJ persona and constraints:
```
你是龙虾电台的DJ小龙，三十出头，是个资深乐迷。
你说话要用道地的香港粤语，像和朋友聊天一样自然。

核心原则：
- 90%是音乐，10%是DJ，你只说开场白，不抢戏
- 点到即止，说1-2句话就好，绝对不能超过3句话
- 不说官话套话，比如"接下来为您播放"这种太官方了
- 可以适当用粤语语气词：㗎、啦、㗅、喔，更自然
- 必须说出歌手名字和歌名

根据用户选择的风格调整语气：
- classic：从容地道的电台感觉
- night：温柔安静，治愈系
- vibe：兴奋有感染力
- trivia：分享一个有趣的小知识
```

**User Prompt:** includes all context:
```
请为以下歌曲生成开场白：
歌手：{artist}
歌名：{title}
专辑：{album}
年份：{year}
流派：{genre}
风格：{style}
当前时间：{timeSegment}

请生成开场白：
```

#### 3. Output Validation

After LLM returns, we:
1. Check length - if longer than ~100 characters, truncate to first two sentences
2. Verify it contains artist/title - if not, fallback
3. Trim any extra whitespace/newlines

### Configuration & User Control

1. **Backend**:
   - Add `enable_ai_narration` boolean to user preferences (stored in SQLite)
   - Default: `true`
   - Environment variable `DISABLE_AI_NARRATION` to force disable server-wide

2. **Frontend**:
   - Add toggle switch on SettingsPage for "AI 智能旁白"
   - Save preference to backend

### Fallback Strategy

If any of these occur, automatically fallback to template generation:
- LLM API timeout (after 5 seconds)
- LLM API error (quota exceeded, auth error, etc.)
- LLM returns empty output
- LLM output fails validation (missing song info, too long)

This guarantees narration is always generated, radio never stops.

### Integration Points

1. **Backend**:
   - `backend/src/routes/wikiRoutes.ts` - modify the generate-narration endpoint to use AI if enabled
   - `backend/src/services/recommendationService.ts` - same for recommendation flow
   - `backend/src/data/schema.sql` - add preference flag (if needed)

2. **Frontend**:
   - `frontend/src/pages/SettingsPage.tsx` - add UI toggle
   - `frontend/src/lib/api.ts` - update API types

## LLM Provider

Reuse existing Gemini API that's already configured for TTS in `ttsService.ts`. No new API keys required.

## Success Criteria

1. Narration is much more varied - no repetitive patterns
2. Output matches the DJ persona in `DJ_PERSONA.md`
3. Narration length stays within 1-2 sentences, doesn't抢戏
4. Fallback works reliably when LLM is unavailable
5. User can toggle the feature on/off in settings

## Trade-offs

- **Latency**: Adds ~1-3 seconds vs template generation. Since narration plays before the song starts, this is acceptable. Users who mind can toggle off.
- **Cost**: Each generation is a small LLM call (short prompt/short completion). Cost should be minimal for personal use.
- **Consistency**: LLM outputs vary - sometimes very good, occasionally less on-brand. Fallback handles failures.
