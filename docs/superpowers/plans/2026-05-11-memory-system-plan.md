# Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Memory System that aggregates user preferences into text summaries for the DJ to use for personalized commentary.

**Architecture:** Create a new utility `MemorySummarizer` in the agents workspace to calculate short-term and long-term memory summaries from the `Preferences` object. Then, update the `NarratorAgent` prompt to inject these memory strings and instruct the LLM to use them to personalize its commentary.

**Tech Stack:** TypeScript, Node.js, Vitest

---

### Task 1: Memory Summarizer Utility

**Files:**
- Create: `agents/src/lib/MemorySummarizer.ts`
- Create: `agents/src/lib/MemorySummarizer.test.ts`
- Modify: `agents/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `agents/src/lib/MemorySummarizer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getShortTermMemory, getLongTermMemory } from './MemorySummarizer.js';

describe('MemorySummarizer', () => {
  it('should return empty string for empty history', () => {
    const prefs = { likes: [], dislikes: [], history: [], moodAffinity: {} };
    expect(getShortTermMemory(prefs)).toBe('');
    expect(getLongTermMemory(prefs)).toBe('');
  });

  it('should aggregate short term memory for recent tracks', () => {
    const now = Date.now();
    const prefs = {
      likes: [], dislikes: [], moodAffinity: {},
      history: [
        { artist: 'A', playedAt: new Date(now).toISOString(), feedback: 'dislike' as const } as any,
        { artist: 'B', playedAt: new Date(now - 1000).toISOString() } as any,
        { artist: 'C', playedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() } as any // Too old
      ]
    };
    const shortTerm = getShortTermMemory(prefs);
    expect(shortTerm).toContain('listened to 2 songs');
    expect(shortTerm).toContain('skipped 1');
  });

  it('should aggregate long term memory for top artists and mood', () => {
    const prefs = {
      likes: [], dislikes: [],
      moodAffinity: { 'Relaxing': 10, 'Working': 20 },
      history: [
        { artist: 'Artist A' } as any,
        { artist: 'Artist B' } as any,
        { artist: 'Artist B' } as any,
        { artist: 'Artist B' } as any,
        { artist: 'Artist C' } as any,
        { artist: 'Artist C' } as any,
      ]
    };
    const longTerm = getLongTermMemory(prefs);
    expect(longTerm).toContain('Artist B');
    expect(longTerm).toContain('Artist C');
    expect(longTerm).toContain('Working');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w agents`
Expected: FAIL because `MemorySummarizer.js` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `agents/src/lib/MemorySummarizer.ts`:
```typescript
import type { Preferences } from "../types.js";

export function getShortTermMemory(prefs: Preferences): string {
  if (!prefs.history || prefs.history.length === 0) return "";

  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  const recentHistory = prefs.history.filter(item => new Date(item.playedAt).getTime() > twelveHoursAgo);

  if (recentHistory.length === 0) return "";

  const totalPlayed = recentHistory.length;
  const skips = recentHistory.filter(item => item.feedback === "dislike").length;

  return `User listened to ${totalPlayed} songs in the last 12 hours and skipped ${skips}.`;
}

export function getLongTermMemory(prefs: Preferences): string {
  if (!prefs.history || prefs.history.length === 0) return "";

  const artistCounts: Record<string, number> = {};
  for (const item of prefs.history) {
    if (item.artist) {
      artistCounts[item.artist] = (artistCounts[item.artist] || 0) + 1;
    }
  }

  const sortedArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  const topArtists = sortedArtists.slice(0, 2);

  let topMood = "none";
  let maxMoodValue = -Infinity;
  if (prefs.moodAffinity) {
    for (const [mood, value] of Object.entries(prefs.moodAffinity)) {
      if (value > maxMoodValue) {
        maxMoodValue = value;
        topMood = mood;
      }
    }
  }

  const artistText = topArtists.length > 0 ? `Their favorite artists include ${topArtists.join(" and ")}.` : "";
  const moodText = topMood !== "none" ? `Their primary mood affinity is ${topMood}.` : "";

  return `${artistText} ${moodText}`.trim();
}
```

Modify `agents/src/index.ts` to export them:
Add: `export * from "./lib/MemorySummarizer.js";`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w agents`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agents/src/lib/MemorySummarizer.ts agents/src/lib/MemorySummarizer.test.ts agents/src/index.ts
git commit -m "feat(agents): add memory summarizer utility for short and long term context"
```

---

### Task 2: Narrator Prompt Integration

**Files:**
- Modify: `agents/src/agents/NarratorAgent.ts`
- Modify: `agents/src/agents/NarratorAgent.test.ts`

- [ ] **Step 1: Write the failing test**

Modify `agents/src/agents/NarratorAgent.test.ts` to include short and long term memory in the test input:
```typescript
  it('should include memory instructions in the user prompt', () => {
    const agent = new NarratorAgent() as unknown as { getUserPrompt: Function };
    const input = {
      mood: 'Working',
      contextSummary: 'Focused afternoon',
      shortTermMemory: 'User listened to 5 songs today and skipped 2.',
      longTermMemory: 'Their favorite artists include Artist B.',
      track: {
        id: '1', title: 'Song', artist: 'Artist', album: 'Album',
        previewUrl: null, artwork: '', moodTags: [], energy: 0,
        explanation: 'A deep electronic track about focus.',
        source: 'local'
      },
      history: []
    } as any;
    const userPrompt = agent.getUserPrompt(input, 0, 'en-US');
    expect(userPrompt).toContain('User listened to 5 songs today and skipped 2.');
    expect(userPrompt).toContain('Their favorite artists include Artist B.');
    expect(userPrompt).toContain('Use the provided Short-Term and Long-Term memory context to make your commentary more personalized.');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w agents`
Expected: FAIL because memory variables aren't used in the prompt yet.

- [ ] **Step 3: Write minimal implementation**

Modify `agents/src/agents/NarratorAgent.ts`:

1. Update `NarratorInput` interface to include the memory fields:
```typescript
interface NarratorInput {
  mood: MoodOption;
  contextSummary: string;
  shortTermMemory?: string;
  longTermMemory?: string;
  track: Track;
  history: PlaybackHistoryItem[];
  style?: DJStyle;
  language?: DJLanguage;
}
```

2. Update `getUserPrompt` to inject the fields and instructions for all languages:

```typescript
  private getUserPrompt(input: NarratorInput, historyCount: number, language: DJLanguage): string {
    const shortMem = input.shortTermMemory || "None";
    const longMem = input.longTermMemory || "None";

    const prompts = {
      "zh-HK": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n短期记忆：${shortMem}\n长期记忆：${longMem}\n而家播放紧：${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听咗${historyCount}首歌\n\n请利用提供嘅短期同长期记忆令你嘅旁白更个性化（例如：如果听众今日成日飞歌，可以讲下转下口味；如果播紧佢最钟意嘅歌手，就提下）。请结合上面嘅歌曲背景同埋你自己对歌手历史、专辑上下文或制作秘密嘅深入了解，用纯正粤语讲一段深刻难忘嘅电台开场白，控制喺 3-4 句。`,

      "zh-CN": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n短期记忆：${shortMem}\n长期记忆：${longMem}\n现在播放：${input.track.artist}的《${input.track.title}》，收录在《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听了${historyCount}首歌\n\n请利用提供的短期和长期记忆让你的旁白更个性化（例如：如果听众今天经常切歌，可以提一下换换口味；如果正播放他们最喜欢的歌手，可以提一下）。请结合上面的歌曲背景和你自己对歌手历史、专辑上下文或制作秘密的深入了解，用普通话说一段深刻难忘的电台开场白，控制在 3-4 句。`,

      "en-US": `Mood mode: ${input.mood}\nContext: ${input.contextSummary}\nShort-Term Memory: ${shortMem}\nLong-Term Memory: ${longMem}\nNow playing: ${input.track.title} by ${input.track.artist}, from ${input.track.album}\nTrack Context: ${input.track.explanation}\nListener has heard ${historyCount} songs\n\nPlease use the provided Short-Term and Long-Term memory context to make your commentary more personalized (e.g., if they skipped a lot today, mention a change of pace; if playing a favorite artist, acknowledge it). Please blend the provided track context with your own deep knowledge of the artist's history, album context, or production secrets to create a profound and memorable radio intro in 3-4 sentences.`
    };

    return prompts[language];
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w agents`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agents/src/agents/NarratorAgent.ts agents/src/agents/NarratorAgent.test.ts
git commit -m "feat(agents): inject memory summaries into Narrator prompts for personalization"
```