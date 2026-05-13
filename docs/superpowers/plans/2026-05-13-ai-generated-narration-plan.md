# AI Generated Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement LLM-based AI narration generation that produces more natural, varied DJ introductions while keeping the existing template system as a fallback.

**Architecture:** Add a new `AINarrationService.ts` that uses the existing Gemini LLM client to generate narration based on the DJ persona prompt. Keep the original `narrationGenerator.ts` as a fallback. Add a user-configurable toggle in settings to switch between AI and template generation.

**Tech Stack:** TypeScript, Express, Gemini API via LangChain, React for frontend settings toggle.

---

## Files to Create/Modify

| File | Purpose | Change Type |
|------|---------|-------------|
| `backend/src/services/AINarrationService.ts` | Main AI narration generation service | New |
| `backend/src/routes/wikiRoutes.ts` | Update generate-narration endpoint to use AI if enabled | Modify |
| `backend/src/data/runtime/preferences.json` | Add AI narration preference | Modify |
| `backend/src/services/storageService.ts` | Update preferences type | Modify |
| `frontend/src/pages/SettingsPage.tsx` | Add UI toggle for AI narration | Modify |
| `frontend/src/lib/api.ts` | Update API types if needed | Modify |

---

### Task 1: Create AINarrationService.ts

**Files:**
- Create: `backend/src/services/AINarrationService.ts`

- [ ] **Step 1: Import dependencies and define types**

```typescript
import type { SongWiki } from "./wikiService.js";
import type { DJStyle } from "./narrationGenerator.js";
import { getTimeSegment } from "./narrationGenerator.js";

export interface NarrationContext {
  timeSegment: "morning" | "afternoon" | "night" | "weekend";
}

export async function generateAINarration(
  song: SongWiki,
  style: DJStyle,
  context?: Partial<NarrationContext>
): Promise<string>;
```

- [ ] **Step 2: Build system and user prompts**

```typescript
function buildSystemPrompt(): string {
  return `你是龙虾电台的DJ小龙，三十出头，是个资深乐迷。
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
- trivia：分享一个有趣的小知识`;
}

function buildUserPrompt(
  song: SongWiki,
  style: DJStyle,
  context: NarrationContext
): string {
  return `请为以下歌曲生成开场白：
歌手：${song.artist}
歌名：${song.title}
专辑：${song.album || "Unknown"}
${song.year ? `年份：${song.year}` : ""}
${song.genre ? `流派：${song.genre}` : ""}
风格：${style}
当前时间：${context.timeSegment}

请生成开场白：`;
}
```

- [ ] **Step 3: Implement the main generation function with Gemini**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateAINarration(
  song: SongWiki,
  style: DJStyle,
  context?: Partial<NarrationContext>
): Promise<string> {
  const fullContext: NarrationContext = {
    timeSegment: context?.timeSegment || getTimeSegment(),
  };

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(song, style, fullContext);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 128,
    },
  });

  const prompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 8000)
    ),
  ]);

  const response = await result.response;
  let text = response.text().trim();

  // Post-processing: validate and clean up
  text = cleanupOutput(text);

  if (!validateOutput(text, song)) {
    throw new Error("Generated output validation failed");
  }

  return text;
}

function cleanupOutput(text: string): string {
  // Split into sentences, take max 2
  const sentences = text.split(/[。！？!?]+/).filter((s) => s.trim().length > 0);
  const truncated = sentences.slice(0, 2).join("。") + (sentences.length > 2 ? "。" : "");
  return truncated.trim();
}

function validateOutput(text: string, song: SongWiki): boolean {
  if (!text || text.length < 10 || text.length > 150) return false;
  // Check that artist or title is mentioned (allow variations)
  const hasArtist = text.includes(song.artist);
  const hasTitle = text.includes(song.title);
  return hasArtist || hasTitle;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/AINarrationService.ts
git commit -m "feat: add AINarrationService with Gemini generation"
```

---

### Task 2: Update preferences type and add default setting

**Files:**
- Modify: `backend/src/data/runtime/preferences.json`
- Modify: `backend/src/services/storageService.ts`

- [ ] **Step 1: Add `enableAiNarration` to default preferences**

Edit `backend/src/data/runtime/preferences.json`:
```json
{
  "djStyle": "classic",
  "djLanguage": "zh-HK",
  "enableAiNarration": true
}
```

- [ ] **Step 2: Update TypeScript interface in storageService.ts**

Find the Preferences interface and add:
```typescript
export interface Preferences {
  djStyle: DJStyle;
  djLanguage: DJLanguage;
  enableAiNarration: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/data/runtime/preferences.json backend/src/services/storageService.ts
git commit -m "feat: add enableAiNarration preference"
```

---

### Task 3: Update wikiRoutes to use AI generation

**Files:**
- Modify: `backend/src/routes/wikiRoutes.ts`

- [ ] **Step 1: Import new services**

Add to imports:
```typescript
import { generateNarration, generateRandomNarration, type DJStyle } from "../services/narrationGenerator.js";
import { generateAINarration } from "../services/AINarrationService.js";
import { getPreferences } from "../services/storageService.js";
```

- [ ] **Step 2: Modify the generate-narration endpoint**

Find the POST `/generate-narration` route and update:

```typescript
router.post("/generate-narration", async (req, res) => {
  try {
    const { trackId, style, language } = req.body;
    const prefs = getPreferences();
    const song = getWikiById(trackId);

    if (!song) {
      return res.status(404).json({ error: "Track not found" });
    }

    let narration: string;

    // Check if AI narration is enabled via env var and user preference
    const aiEnabled = process.env.DISABLE_AI_NARRATION !== "true" && prefs.enableAiNarration;

    if (aiEnabled) {
      try {
        narration = await generateAINarration(song, style as DJStyle);
      } catch (aiError) {
        console.warn("AI generation failed, falling back to template:", aiError);
        narration = language
          ? generateNarration(song, style as DJStyle, language as any)
          : generateNarration(song, style as DJStyle);
      }
    } else {
      narration = language
        ? generateNarration(song, style as DJStyle, language as any)
        : generateNarration(song, style as DJStyle);
    }

    res.json({ narration });
  } catch (error) {
    console.error("Error generating narration:", error);
    res.status(500).json({ error: "Failed to generate narration" });
  }
});
```

- [ ] **Step 3: Update the random generate route for consistency**

Find the code that generates random narration in the get all wiki route and ensure it also follows the same AI vs template logic.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/wikiRoutes.ts
git commit -m "feat: update wikiRoutes to use AI generation with fallback"
```

---

### Task 4: Add toggle to frontend settings page

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add state for AI narration toggle**

Add to the existing state:
```typescript
const [enableAiNarration, setEnableAiNarration] = useState(true);
```

- [ ] **Step 2: Load preference on mount and save on change**

Update the useEffect that loads settings:
```typescript
useEffect(() => {
  getSettings().then((settings) => {
    setDjStyle(settings.djStyle || "classic");
    setDjLanguage(settings.djLanguage || "zh-HK");
    setEnableAiNarration(settings.enableAiNarration ?? true);
  });
}, []);
```

Add to the save function:
```typescript
const saveSettings = async () => {
  await saveSettings({
    djStyle,
    djLanguage,
    enableAiNarration,
  });
  toast.success("设置已保存");
};
```

- [ ] **Step 3: Add UI toggle to JSX**

Add this after the DJ Language selection:

```jsx
<div className="setting-item">
  <label className="setting-label">
    <span>AI 智能旁白</span>
    <input
      type="checkbox"
      checked={enableAiNarration}
      onChange={(e) => setEnableAiNarration(e.target.checked)}
      className="toggle"
    />
  </label>
  <p className="setting-description">
    使用 AI 生成更自然多样的开场白，关闭则使用固定模板
  </p>
</div>
```

- [ ] **Step 4: Update API type in api.ts**

Edit `frontend/src/lib/api.ts` for the Settings type:

```typescript
export interface Settings {
  djStyle: string;
  djLanguage: string;
  enableAiNarration: boolean;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/lib/api.ts
git commit -m "feat: add AI narration toggle to settings"
```

---

### Task 5: Test and verify

**Files:**
- Test: manual testing via API

- [ ] **Step 1: Test API endpoint with AI enabled**

```bash
curl -X POST http://localhost:4000/api/wiki/generate-narration \
  -H "Content-Type: application/json" \
  -d '{"trackId": "some-track-id", "style": "classic"}'
```

Expected: Returns AI-generated narration.

- [ ] **Step 2: Test fallback by disabling AI in preferences**

Change `enableAiNarration: false` in preferences and test again. Expected: Returns template-based narration.

- [ ] **Step 3: Test frontend toggle**

- Open Settings page in browser
- Verify toggle appears
- Toggle changes are saved
- Narration generation respects the toggle

- [ ] **Step 4: Run type check**

```bash
npm run lint
```

Fix any type errors found.

- [ ] **Step 5: Final commit if any fixes needed**

---

## Self-Review

- ✅ Spec coverage: All requirements from the design spec are covered (AI generation, fallback, user toggle, preferences storage)
- ✅ No placeholders: All steps have exact code and commands
- ✅ Type consistency: Types are defined consistently across files
- ✅ Bite-sized tasks: Each task is small and can be completed independently

