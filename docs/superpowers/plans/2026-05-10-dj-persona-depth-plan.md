# DJ Persona Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Lobster Radio DJ to deliver profound, 3-4 sentence musical insights by blending provided track context with the LLM's internal knowledge.

**Architecture:** Modifies `NarratorAgent.ts` prompts to require longer text (3-4 sentences), pass in `track.explanation`, and ask for style-specific insights. Also upgrades the hardcoded fallbacks to be richer and 2-3 sentences long.

**Tech Stack:** TypeScript, Node.js, Vitest (to be added for testing)

---

### Task 1: Setup Testing for Agents

**Files:**
- Modify: `agents/package.json`

- [ ] **Step 1: Install Vitest in the agents workspace**

```bash
npm install -D vitest -w agents
```

- [ ] **Step 2: Add test script**
Modify `agents/package.json` to include `"test": "vitest run"` in the scripts section.

```json
  "scripts": {
    "dev": "tsc -w -p tsconfig.json --preserveWatchOutput",
    "build": "tsc -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Run test script to ensure it fails gracefully (no tests yet)**

```bash
npm run test -w agents
```
Expected: FAIL with "No test files found"

- [ ] **Step 4: Commit**

```bash
git add agents/package.json package-lock.json
git commit -m "chore(agents): add vitest for testing"
```

---

### Task 2: Prompt Restructuring & Sentence Limit

**Files:**
- Create: `agents/src/agents/NarratorAgent.test.ts`
- Modify: `agents/src/agents/NarratorAgent.ts`

- [ ] **Step 1: Write the failing test**
Create `agents/src/agents/NarratorAgent.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { NarratorAgent } from './NarratorAgent.js';

describe('NarratorAgent Prompts', () => {
  it('should request 3-4 sentences in the system prompt', () => {
    const agent = new NarratorAgent() as any;
    const sysPrompt = agent.getSystemPrompt('classic', 'en-US');
    expect(sysPrompt).toContain('3-4 sentences');
    expect(sysPrompt).not.toContain('1-2 sentences');
  });

  it('should include track explanation and blend instructions in the user prompt', () => {
    const agent = new NarratorAgent() as any;
    const input = {
      mood: 'Working',
      contextSummary: 'Focused afternoon',
      track: {
        id: '1', title: 'Song', artist: 'Artist', album: 'Album',
        previewUrl: null, artwork: '', moodTags: [], energy: 0,
        explanation: 'A deep electronic track about focus.',
        source: 'local'
      },
      history: []
    } as any;
    const userPrompt = agent.getUserPrompt(input, 0, 'en-US');
    expect(userPrompt).toContain('A deep electronic track about focus.');
    expect(userPrompt).toContain('Blend the provided track context with your own deep knowledge');
    expect(userPrompt).toContain('3-4 sentences');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm run test -w agents
```
Expected: FAIL because `getSystemPrompt` contains "1-2 sentences".

- [ ] **Step 3: Write minimal implementation**
Modify `agents/src/agents/NarratorAgent.ts`:
1. In `getSystemPrompt`, change "1-2 句，唔好太长" to "3-4 句" for `zh-HK`, "1-2 句，不要太长" to "3-4 句" for `zh-CN`, and "1-2 sentences, don't make it too long" to "3-4 sentences" for `en-US`.
2. In `getUserPrompt`, add `Track Context: ${input.track.explanation}` to the context block.
3. In `getUserPrompt`, update the final instruction for all languages to request 3-4 sentences and instruct the LLM to blend context with its own knowledge.

```typescript
// Replace lines in getSystemPrompt:
    const prompts = {
      "zh-HK": `你系龙虾电台嘅AI DJ，一个地道嘅香港电台主持。用纯正粤语讲嘢，语气要自然、亲切，似同朋友倾计一样。风格：${styleDescriptions["zh-HK"][style]}。旁白控制喺 3-4 句，提供有深度嘅音乐见解。`,
      "zh-CN": `你是龙虾电台的AI DJ，一个地道的电台主持人。用普通话说话，语气要自然、亲切，像和朋友聊天一样。风格：${styleDescriptions["zh-CN"][style]}。旁白控制在 3-4 句，提供有深度的音乐见解。`,
      "en-US": `You are an AI DJ for Lobster Radio, an authentic radio host. Speak naturally and warmly, like talking to a friend. Style: ${styleDescriptions["en-US"][style]}. Keep it to 3-4 sentences and provide deep musical insights.`,
    };

// Replace lines in getUserPrompt:
    const prompts = {
      "zh-HK": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n而家播放紧：${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听咗${historyCount}首歌\n\n请结合上面嘅歌曲背景同埋你自己对歌手历史、专辑上下文或制作秘密嘅深入了解，用纯正粤语讲一段深刻难忘嘅电台开场白，控制喺 3-4 句。`,
      "zh-CN": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n现在播放：${input.track.artist}的《${input.track.title}》，收录在《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听了${historyCount}首歌\n\n请结合上面的歌曲背景和你自己对歌手历史、专辑上下文或制作秘密的深入了解，用普通话说一段深刻难忘的电台开场白，控制在 3-4 句。`,
      "en-US": `Mood mode: ${input.mood}\nContext: ${input.contextSummary}\nNow playing: ${input.track.title} by ${input.track.artist}, from ${input.track.album}\nTrack Context: ${input.track.explanation}\nListener has heard ${historyCount} songs\n\nPlease blend the provided track context with your own deep knowledge of the artist's history, album context, or production secrets to create a profound and memorable radio intro in 3-4 sentences.`,
    };
```

- [ ] **Step 4: Run test to verify it passes**
```bash
npm run test -w agents
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add agents/src/agents/NarratorAgent.ts agents/src/agents/NarratorAgent.test.ts
git commit -m "feat(agents): increase DJ length to 3-4 sentences and inject track explanation"
```

---

### Task 3: Style-Specific Insights

**Files:**
- Modify: `agents/src/agents/NarratorAgent.ts`
- Modify: `agents/src/agents/NarratorAgent.test.ts`

- [ ] **Step 1: Write the failing test**
Add to `agents/src/agents/NarratorAgent.test.ts`:
```typescript
  it('should include specific insight instructions per style', () => {
    const agent = new NarratorAgent() as any;
    expect(agent.getSystemPrompt('classic', 'en-US')).toContain('career trajectory');
    expect(agent.getSystemPrompt('night', 'en-US')).toContain('lyrical meaning');
    expect(agent.getSystemPrompt('vibe', 'en-US')).toContain('cultural impact');
    expect(agent.getSystemPrompt('trivia', 'en-US')).toContain('recording process');
  });
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm run test -w agents
```
Expected: FAIL because style descriptions are too generic currently.

- [ ] **Step 3: Write minimal implementation**
Modify `styleDescriptions` inside `getSystemPrompt` in `agents/src/agents/NarratorAgent.ts` to include the specific focus:

```typescript
    const styleDescriptions = {
      "zh-HK": {
        classic: "经典电台主持风格，亲切、专业，带一点点怀旧感。专注分享歌手嘅职业生涯发展、奖项同传奇成就。",
        night: "深夜治愈系，温柔、安静，适合夜晚收听。专注探讨歌词嘅深层含义、情感同歌曲嘅氛围背景。",
        vibe: "活力蹦迪风，热情、兴奋，带动听众情绪。专注分享歌曲嘅能量、制作技巧同文化影响力。",
        trivia: "冷知识科普风，有趣、有料，带一点点书卷气。专注挖掘冷门事实、录音过程同隐藏嘅细节。"
      },
      "zh-CN": {
        classic: "经典电台主持风格，亲切、专业，带一点怀旧感。专注分享歌手的职业生涯发展、奖项和传奇成就。",
        night: "深夜治愈系，温柔、安静，适合夜晚收听。专注探讨歌词的深层含义、情感和歌曲的氛围背景。",
        vibe: "活力派对风，热情、兴奋，带动听众情绪。专注分享歌曲的能量、制作技巧和文化影响力。",
        trivia: "冷知识科普风，有趣、有料，带一点书卷气。专注挖掘冷门事实、录音过程和隐藏的细节。"
      },
      "en-US": {
        classic: "Classic radio host style, warm, professional, with a touch of nostalgia. Focus on the artist's career trajectory, awards, and legacy.",
        night: "Late night healing vibes, gentle, quiet, perfect for nighttime listening. Focus on lyrical meaning, emotions, and the atmospheric background of the song.",
        vibe: "High-energy party mode, enthusiastic, exciting, pumping up the audience. Focus on the energy, production techniques, and cultural impact.",
        trivia: "Fun facts style, interesting, informative, with a touch of sophistication. Focus on deep-cut facts, recording process, and hidden details."
      }
    };
```

- [ ] **Step 4: Run test to verify it passes**
```bash
npm run test -w agents
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add agents/src/agents/NarratorAgent.ts agents/src/agents/NarratorAgent.test.ts
git commit -m "feat(agents): add style-specific insight instructions for DJ"
```

---

### Task 4: Upgraded Fallbacks

**Files:**
- Modify: `agents/src/agents/NarratorAgent.ts`
- Modify: `agents/src/agents/NarratorAgent.test.ts`

- [ ] **Step 1: Write the failing test**
Add to `agents/src/agents/NarratorAgent.test.ts`:
```typescript
  it('should return longer fallbacks (2-3 sentences)', () => {
    const agent = new NarratorAgent() as any;
    const track = { title: 'Test', artist: 'Tester', album: 'Album' } as any;
    const classicFallback = agent.getFallbackTemplate(track, 'classic', 'en-US');
    const sentences = classicFallback.split('.').filter((s: string) => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    // Spot check one of the new profound generic sentences
    expect(agent.getFallbackTemplate(track, 'night', 'en-US')).toMatch(/(mood|unwind|melody|atmosphere)/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm run test -w agents
```
Expected: Current fallback sentences might pass the length test if they have multiple punctuation marks, but they won't feel profound. Actually, some only have 1 period. Wait, we'll rewrite them to be strictly richer anyway. Let's make sure it fails if we look for the new content or specific sentence length.

- [ ] **Step 3: Write minimal implementation**
Rewrite the `templates` object in `getFallbackTemplate` inside `agents/src/agents/NarratorAgent.ts`:

```typescript
    const templates = {
      "zh-HK": {
        classic: [
          `欢迎返到龙虾电台，而家为你送上嘅系${track.artist}嘅《${track.title}》。呢首歌收录喺大碟《${track.album}》入面，见证住佢地音乐旅程上嘅一个重要时刻。希望呢把熟悉嘅声音可以唤起你心底嘅共鸣。`,
          `正在锁定龙虾电台，而家播紧嘅系${track.artist}嘅《${track.title}》。一首经典嘅好歌，往往可以带我地穿越时空，返到最纯粹嘅一刻。一齐嚟用心欣赏啦。`
        ],
        night: [
          `夜阑人静，等${track.artist}嘅《${track.title}》陪你度过呢个安静嘅夜晚。旋律当中流露嘅细腻情感，好啱而家静落嚟嘅心情。由得音乐带走全日嘅疲惫啦。`,
          `而家系深夜时分，听听${track.artist}嘅《${track.title}》。每一个音符都仿佛喺度同夜空对话，安抚住每一颗未瞓嘅心。送俾夜猫子嘅你。`
        ],
        vibe: [
          `嚟啦嚟啦！就系而家！${track.artist}嘅《${track.title}》！呢首歌嘅节奏同编曲真系无得顶，绝对系带动气氛嘅绝佳之作。跟住节奏一齐郁啦！`,
          `各位朋友！准备好未！${track.artist}嘅《${track.title}》准备炸爆你嘅喇叭。呢种充满能量嘅音乐风格，就系我地而家最需要嘅感觉！`
        ],
        trivia: [
          `同你分享一个细节，${track.artist}嘅《${track.title}》其实蕴含住好多精心设计嘅音乐元素。这首歌收录喺《${track.album}》入面，绝对值得你细细品味。试下听埋背景入面嘅层次感啦。`
        ]
      },
      "zh-CN": {
        classic: [
          `欢迎回到龙虾电台，现在为你送上的是${track.artist}的《${track.title}》。这首歌收录在专辑《${track.album}》中，见证了他们音乐旅程上的一个重要时刻。希望这熟悉的声音能唤起你心底的共鸣。`,
          `正在收听龙虾电台，现在播放的是${track.artist}的《${track.title}》。一首经典的好歌，往往能带我们穿越时空，回到最纯粹的那一刻。一起来用心欣赏吧。`
        ],
        night: [
          `夜深人静，让${track.artist}的《${track.title}》陪你度过这个安静的夜晚。旋律中流露的细腻情感，很适合现在平静的心情。让音乐带走一天的疲惫吧。`,
          `现在是深夜时分，听听${track.artist}的《${track.title}》。每一个音符都仿佛在与夜空对话，安抚着每一颗未眠的心。送给夜猫子的你。`
        ],
        vibe: [
          `来了来了！就是现在！${track.artist}的《${track.title}》！这首歌的节奏和编曲真是绝了，绝对是带动气氛的绝佳之作。跟着节奏一起动起来吧！`,
          `各位朋友！准备好了吗！${track.artist}的《${track.title}》准备燃爆你的音箱。这种充满能量的音乐风格，就是我们现在最需要的感觉！`
        ],
        trivia: [
          `和你分享一个细节，${track.artist}的《${track.title}》其实蕴含着很多精心设计的音乐元素。这首歌收录在《${track.album}》中，绝对值得你细细品味。试着听听背景里的层次感吧。`
        ]
      },
      "en-US": {
        classic: [
          `Welcome back to Lobster Radio. Now playing ${track.title} by ${track.artist}, from the album ${track.album}. This track really marks a pivotal moment in their musical journey. Hope this familiar voice brings back some great memories.`,
          `You're tuned to Lobster Radio. Here's ${track.title} by ${track.artist}. A truly classic song has the power to transport us through time, back to our purest moments. Let's enjoy this masterpiece together.`
        ],
        night: [
          `Late into the night, let ${track.title} by ${track.artist} accompany you through this quiet evening. The delicate emotions in this melody perfectly capture the stillness of the midnight hours. Let the music wash away the fatigue of your day.`,
          `It's the late night hours. Here's ${track.title} by ${track.artist}. Every note feels like a conversation with the night sky, soothing every restless soul. This one goes out to all you night owls.`
        ],
        vibe: [
          `Here we go! Right now! ${track.title} by ${track.artist}! The production and rhythm on this track are absolutely unbelievable. It's the exact energy we need to elevate this moment, so move to the beat!`,
          `Everyone! Are you ready! ${track.title} by ${track.artist} is about to blow through your speakers. The cultural impact and pure energy of this sound is undeniable. Let me hear you!`
        ],
        trivia: [
          `Let me share a quick detail with you: ${track.title} by ${track.artist} is actually packed with incredibly clever musical elements. Coming from the album ${track.album}, it completely deserves a deeper listen. Try to catch the subtle layers hidden in the background.`
        ]
      }
    };
```

- [ ] **Step 4: Run test to verify it passes**
```bash
npm run test -w agents
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add agents/src/agents/NarratorAgent.ts agents/src/agents/NarratorAgent.test.ts
git commit -m "feat(agents): upgrade dj fallbacks to longer profound scripts"
```
