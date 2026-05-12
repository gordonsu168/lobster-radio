# Radio 歌曲间闲聊 + 歌中冷知识插播 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Infinite AI Radio 模式增加两个功能：(1) 每首歌结束后播放 DJ 对刚播完歌曲的闲聊评论；(2) 歌曲播放到一半时，如果有预存冷知识则轻声插播。增强真实电台沉浸感。

**Architecture:** 采用混合模式设计：后端新增两个 API 接口 (`outro` 和 `trivia`)，优先返回预存在 SongWiki 的 `djMaterial` 素材，没有素材则 outro 使用 AI 生成，trivia 只返回预存素材（用户要求"确实有趣才加"）。前端修改播放流程，增加 outro 播放，并实现歌曲进度监听和冷知识插播时的音量自动调节。

**Tech Stack:** 后端：Express + TypeScript + NarratorAgent；前端：React + HTML5 Audio API；TTS：现有语音合成服务。

---

### Task 1: 后端新增 outro 生成 API

**Files:**
- Modify: `backend/src/routes/wikiRoutes.ts`

- [ ] **Step 1: 在 wikiRoutes.ts 新增 POST /outro/:id 接口**

找到 `wikiRouter.post("/narration/:id", ...)` 那一段，在它后面添加：

```typescript
// 生成歌曲结束 outro 闲聊
wikiRouter.post("/outro/:id", async (req: Request, res: Response) => {
  try {
    const { style, language } = req.body as { style?: DJStyle; language?: string };
    const song = await getSongWiki(req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    let outro: string;

    // 如果有预存的 outro 素材，随机选一条
    if (song.djMaterial?.outro && song.djMaterial.outro.length > 0) {
      const outres = song.djMaterial.outro;
      outro = outres[Math.floor(Math.random() * outres.length)];
    } else if (song.djMaterial?.vibe && song.djMaterial.vibe.length > 0) {
      // 如果没有 outro 但有 vibe 素材，用 vibe
      const vibes = song.djMaterial.vibe;
      outro = vibes[Math.floor(Math.random() * vibes.length)];
    } else {
      // 没有预存素材，调用 NarratorAgent 生成
      try {
        const narratorAgent = new NarratorAgent();
        outro = await narratorAgent.generateOutro(song, style || "classic", (language || "zh-CN") as any);
      } catch (error) {
        console.error("NarratorAgent generateOutro failed, falling back to template:", error);
        // fallback 模板
        outro = `${song.artist}的《${song.title}》听完了，希望你喜欢。接下来，我们继续听下一首歌。`;
      }
    }

    res.json({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      style: style || "classic",
      outro,
      generated: !song.djMaterial?.outro?.length,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate outro" });
  }
});
```

- [ ] **Step 2: 需要的导入已经在文件顶部吗？检查**

文件顶部已经有：
```typescript
import { generateNarration, generateRandomNarration, type DJStyle } from "../services/narrationGenerator.js";
import { NarratorAgent } from "lobster-radio-agents";
```
确保 `NarratorAgent` 已导入，如果没加加上。

- [ ] **Step 3: 在 NarratorAgent 添加 generateOutro 方法**

**File:** `agents/src/agents/NarratorAgent.ts`

在 `generate()` 方法后面添加新方法：

```typescript
public async generateOutro(song: SongWiki, style: DJStyle = "classic", language: DJLanguage = "zh-CN"): Promise<string> {
  const model = createOptionalModel();

  if (!model) {
    return this.getFallbackOutro(song.artist, song.title, style, language);
  }

  const systemPrompt = this.getOutroSystemPrompt(style, language);
  const userPrompt = this.getOutroUserPrompt(song, language);

  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]);

  return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
}

private getFallbackOutro(artist: string, title: string, style: DJStyle, language: DJLanguage): string {
  const fallbacks = {
    "zh-CN": `${artist}的《${title}》听完了，希望你喜欢。接下来继续下一首歌。`,
    "zh-HK": `${artist}嘅《${title}》听完咗，希望你钟意。跟住继续听下一首歌。`,
    "en-US": `That was ${title} by ${artist}. Hope you enjoyed it. Coming up next, we have another track for you.`
  };
  return fallbacks[language] || fallbacks["zh-CN"];
}

private getOutroSystemPrompt(style: DJStyle, language: DJLanguage): string {
  const prompts = {
    "zh-HK": `你系龙虾电台嘅AI DJ。刚播完一首歌，用1-2句话简单讲下对呢首歌嘅感受，然后自然过渡到下一首歌。语气要亲切自然，唔好太长。`,
    "zh-CN": `你是龙虾电台的AI DJ。刚播放完一首歌，用1-2句话简单谈谈对这首歌的感受，然后自然过渡到下一首歌。语气要亲切自然，不要太长。`,
    "en-US": `You are the AI DJ for Lobster Radio. We just finished playing a song. Give a quick 1-2 sentence comment on the track, then transition naturally to the next song. Keep it warm and conversational, don't make it too long.`
  };
  return prompts[language];
}

private getOutroUserPrompt(song: SongWiki, language: DJLanguage): string {
  const prompts = {
    "zh-HK": `刚播完嘅系：${song.artist} - 《${song.title}》，专辑：《${song.album}》\n背景：${song.explanation || "暂无"}\n\n请讲一段简短嘅ending评论：`,
    "zh-CN": `刚播放完的是：${song.artist} - 《${song.title}》，专辑：《${song.album}》\n背景：${song.explanation || "暂无"}\n\n请说一段简短的结尾评论：`,
    "en-US": `We just finished playing: ${song.title} by ${song.artist}, from the album ${song.album}\nContext: ${song.explanation || "None"}\n\nGive a quick closing comment:`
  };
  return prompts[language];
}
```

> Note: 需要在文件顶部添加 `import type { SongWiki } from "../types.js";` 导入类型，如果还没有的话。

- [ ] **Step 4: 编译 agents 代码**

```bash
cd agents && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/wikiRoutes.ts agents/src/agents/NarratorAgent.ts agents/dist/*.js
git commit -m "feat: add outro API endpoint and NarratorAgent.generateOutro"
```

---

### Task 2: 后端新增 trivia 获取 API

**Files:**
- Modify: `backend/src/routes/wikiRoutes.ts`

- [ ] **Step 1: 在 wikiRoutes.ts 新增 POST /trivia/:id 接口**

在刚添加的 `/outro/:id` 后面添加：

```typescript
// 获取歌曲中间插播的冷知识 trivia
wikiRouter.post("/trivia/:id", async (req: Request, res: Response) => {
  try {
    const song = await getSongWiki(req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // 只返回预存素材，不自动生成（用户要求：确实有趣的才加上）
    let trivia: string | null = null;
    if (song.djMaterial?.funFact && song.djMaterial.funFact.length > 0) {
      const facts = song.djMaterial.funFact;
      trivia = facts[Math.floor(Math.random() * facts.length)];
    } else if (song.trivia && song.trivia.length > 0) {
      // fallback 到旧 trivia 字段
      trivia = song.trivia[Math.floor(Math.random() * song.trivia.length)];
    }

    res.json({
      songId: song.id,
      title: song.title,
      hasTrivia: !!trivia,
      trivia,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to get trivia" });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/wikiRoutes.ts
git commit -m "feat: add trivia API endpoint for mid-track insertion"
```

---

### Task 3: 前端新增 API 客户端方法

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 添加 generateOutro 和 getTrivia 函数**

在文件末尾附近（其他 generate* 函数附近）添加：

```typescript
export async function generateOutro(songId: string, style: DJStyle, language: string): Promise<{ outro: string }> {
  const response = await fetch(`${API_BASE}/wiki/outro/${songId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ style, language }),
  });
  return response.json();
}

export async function getTrivia(songId: string): Promise<{ hasTrivia: boolean; trivia: string | null }> {
  const response = await fetch(`${API_BASE}/wiki/trivia/${songId}`, {
    method: "POST",
  });
  return response.json();
}

export async function synthesizeNarration(
  text: string,
  voice: VoiceOption,
  options?: { emotion?: string; language?: string }
): Promise<{ audioBase64: string; mimeType: string }> {
```

确保类型导入包含 `DJStyle`：
```typescript
import type { MoodOption, PreferencesSnapshot, RecommendationPayload, Track, VoiceOption, DJStyle } from "../types";
```

- [ ] **Step 2: 导出这些函数（如果使用命名导出）检查** → 已经上面是命名导出了。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add generateOutro and getTrivia API client methods"
```

---

### Task 4: 前端修改 RadioModePage 播放流程

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx`

- [ ] **Step 1: 添加新的 state refs**

在现有 state 声明后添加：

```typescript
const [currentOutro, setCurrentOutro] = useState<string>("");
const [currentTrivia, setCurrentTrivia] = useState<string>("");
const triviaTriggeredRef = useRef(false); // 是否已触发过本次插播
const hasCurrentTriviaRef = useRef(false);
```

确保导入新增的 API 函数：

```typescript
import {
  getPreferences,
  getRecommendations,
  getSettings,
  generateNarration,
  generateOutro,
  getTrivia,
  synthesizeNarration,
  submitFeedback,
  type ChatMessage,
} from "../lib/api";
```

- [ ] **Step 2: 修改 handleTrackEnd 方法**

找到 `handleTrackEnd` 方法（~line 83），替换为：

```typescript
// 当当前歌曲播放完毕，先播 outro，再加载下一首
const handleTrackEnd = async () => {
  if (isNarrationPlayingRef.current) {
    isNarrationPlayingRef.current = false;
    return;
  }

  if (isLoadingNextRef.current) {
    return;
  }

  isLoadingNextRef.current = true;

  // 新增：如果有当前歌曲，先播放 outro
  if (currentTrack) {
    try {
      const { outro } = await generateOutro(currentTrack.id, djStyle, djLanguage);
      setCurrentOutro(outro);
      await playOutroThenNext(outro);
    } catch (err) {
      console.warn("Outro generation failed, skipping:", err);
      await playNextTrack();
    }
  } else {
    await playNextTrack();
  }

  isLoadingNextRef.current = false;
};
```

- [ ] **Step 3: 添加 playOutroThenNext 新方法**

在 `playNarrationThenMusic` 方法附近添加：

```typescript
// 播放 outro 闲聊，然后播放下一首歌的旁白和音乐
const playOutroThenNext = async (outroText: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!audioRef.current) {
      resolve();
      return;
    }

    userInteractedRef.current = true;
    audioRef.current.pause();

    const afterOutroEnded = () => {
      isNarrationPlayingRef.current = false;
      playNextTrack();
      resolve();
    };

    synthesizeNarration(outroText, voice, { emotion: djEmotion, language: djLanguage })
      .then(response => {
        if (response.audioBase64 && audioRef.current) {
          const binary = atob(response.audioBase64);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
          const url = URL.createObjectURL(blob);

          isNarrationPlayingRef.current = true;
          audioRef.current.src = url;
          audioRef.current.load();
          setIsPlaying(true);

          audioRef.current.addEventListener("ended", afterOutroEnded, { once: true });
          audioRef.current.play().catch(afterOutroEnded);
        } else {
          // 没有音频，直接继续
          playNextTrack();
          resolve();
        }
      })
      .catch(() => {
        // 出错直接继续
        playNextTrack();
        resolve();
      });
  });
};
```

- [ ] **Step 4: 添加 mid-track trivia 处理方法**

在 `playNarrationThenMusic` 完成后，监听音乐播放并在 40% 进度时触发 trivia：

```typescript
// 处理歌曲进度，触发 mid-track trivia 插播
const handleTimeUpdate = () => {
  if (!audioRef.current || !currentTrack || !hasCurrentTriviaRef.current || triviaTriggeredRef.current) {
    return;
  }

  const duration = audioRef.current.duration;
  const currentTime = audioRef.current.currentTime;

  // 在歌曲 30% - 50% 区间触发（选大约中间位置）
  if (currentTime > duration * 0.3 && currentTime < duration * 0.6) {
    triviaTriggeredRef.current = true;
    playMidTrackTrivia();
  }
};

// 播放 mid-track 冷知识旁白（降低主音量 → 播旁白 → 恢复音量）
const playMidTrackTrivia = async () => {
  if (!currentTrack || !audioRef.current) return;

  try {
    const { hasTrivia, trivia } = await getTrivia(currentTrack.id);
    if (!hasTrivia || !trivia) return;

    setCurrentTrivia(trivia);
    const originalVolume = audioRef.current.volume;

    // 降低主音乐音量
    audioRef.current.volume = 0.25;

    // 播放 trivia
    return new Promise<void>((resolve) => {
      synthesizeNarration(trivia, voice, { emotion: "whisper", language: djLanguage })
        .then(response => {
          if (response.audioBase64 && audioRef.current) {
            const binary = atob(response.audioBase64);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            const tempAudio = new Audio(url);
            tempAudio.play();
            tempAudio.onended = () => {
              if (audioRef.current) {
                audioRef.current.volume = originalVolume;
              }
              setCurrentTrivia("");
              resolve();
            };
            tempAudio.onerror = () => {
              if (audioRef.current) {
                audioRef.current.volume = originalVolume;
              }
              setCurrentTrivia("");
              resolve();
            };
          } else {
            if (audioRef.current) {
              audioRef.current.volume = originalVolume;
            }
            setCurrentTrivia("");
            resolve();
          }
        })
        .catch(() => {
          if (audioRef.current) {
            audioRef.current.volume = originalVolume;
          }
          setCurrentTrivia("");
          resolve();
        });
    });
  } catch (err) {
    console.warn("Mid-track trivia failed, skipping:", err);
  }
};
```

- [ ] **Step 5: 修改 playNextTrack 中的 trivia 状态重置**

在 `playNextTrack` 方法开头添加：

```typescript
// 重置 trivia 状态
triviaTriggeredRef.current = false;
hasCurrentTriviaRef.current = true; // 默认检查，getTrivia 会告诉我们有没有
setCurrentTrivia("");
setCurrentOutro("");
```

- [ ] **Step 6: 在 audio 元素添加 onTimeUpdate 事件监听**

找到 `audio` 元素 (~line 273)，添加：

```jsx
<audio
  ref={audioRef}
  onEnded={handleTrackEnd}
  onTimeUpdate={handleTimeUpdate}
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
  crossOrigin="anonymous"
  preload="auto"
/>
```

- [ ] **Step 7: 在 UI 添加 Outro 和 Trivia 展示**

找到 `{currentNarration && (...)}}` DJ Intro 那块 (~line 359)，在它后面添加：

```jsx
              {/* DJ Outro - 歌曲结束闲聊 */}
              {currentOutro && (
                <div className="mt-4 rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-mist mb-3 text-center">DJ Outro</p>
                  <p className="text-base leading-relaxed text-slate-200 text-center italic">
                    {currentOutro}
                  </p>
                </div>
              )}

              {/* DJ Trivia - 歌曲中间插播 */}
              {currentTrivia && (
                <div className="mt-4 rounded-[28px] border border-yellow-300/30 bg-yellow-500/10 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-mist mb-3 text-center">💡 Trivia</p>
                  <p className="text-base leading-relaxed text-slate-200 text-center italic">
                    {currentTrivia}
                  </p>
                </div>
              )}
```

- [ ] **Step 8: 测试编译**

```bash
cd frontend && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "feat: add outro playback and mid-track trivia insertion to RadioMode"
```

---

### Task 5: 验证功能和测试

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: 启动前端开发服务器**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: 打开浏览器到 Radio 模式测试**

测试要点：
1. 每首歌结束后是否播放 outro 闲聊？
2. outro 播放完是否自动播放下一首？
3. 有 funFact 素材的歌曲是否在播放中间插播 trivia？
4. 插播时主音乐音量是否降低？播完恢复？
5. UI 是否正确显示 outro 和 trivia 文字？

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Final commit if any fixes**
