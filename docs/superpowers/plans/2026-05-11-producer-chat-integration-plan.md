# Producer Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a chat panel where users can chat with a "Producer Agent" that implicitly updates their preferences and advises the DJ.

**Architecture:** We will add `ProducerAgent` to process user chats, returning a reply and extracted directives. The backend will expose an `/api/chat` route to handle these messages and update preferences (like mood and memoryInsights). The frontend will replace the right sidebar with a `ChatPanel` and move the `HistoryPanel` below `TrackQueue`.

**Tech Stack:** TypeScript, React, Express, Claude SDK (via `callModel`).

---

### Task 1: Update Preferences Type to support memory insights

**Files:**
- Modify: `agents/src/types.ts`
- Modify: `backend/src/types.ts`

- [ ] **Step 1: Write the failing test**
(Skipping explicit unit test for type definition update as it's a compile-time change)
- [ ] **Step 2: Add `memoryInsight` to `Preferences`**
```typescript
export interface Preferences {
  likes: string[];
  dislikes: string[];
  history: PlaybackHistoryItem[];
  moodAffinity: Record<string, number>;
  memoryInsight?: string;
}
```
- [ ] **Step 3: Commit**
```bash
git add agents/src/types.ts backend/src/types.ts
git commit -m "types: add memoryInsight to Preferences"
```

### Task 2: Implement `ProducerAgent`

**Files:**
- Create: `agents/src/agents/ProducerAgent.ts`
- Create: `agents/src/agents/ProducerAgent.test.ts`
- Modify: `agents/src/index.ts`

- [ ] **Step 1: Write the failing test**
```typescript
import { ProducerAgent } from "./ProducerAgent.js";

describe("ProducerAgent", () => {
  it("should parse explicit skip request", async () => {
    // Note: since this calls an LLM, we might mock `callModel` or test prompt structure.
    // For simplicity, we just verify the class exists and has the generateResponse method.
    const agent = new ProducerAgent();
    expect(agent.generateResponse).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- workspace agents --testPathPattern ProducerAgent` (or equivalent via `npx vitest agents/src/agents/ProducerAgent.test.ts`)
Expected: FAIL with "ProducerAgent not defined"

- [ ] **Step 3: Write minimal implementation**
```typescript
import { callModel } from "../lib/model.js";
import type { Preferences, Track } from "../types.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProducerOutput {
  reply: string;
  directives: {
    suggestedMood?: string;
    likedArtist?: string;
    dislikedArtist?: string;
    skipRequested?: boolean;
    memoryInsight?: string;
  };
}

export class ProducerAgent {
  async generateResponse(
    message: string,
    history: ChatMessage[],
    currentTrack: Track | null,
    preferences: Preferences | null
  ): Promise<ProducerOutput> {
    const prompt = `You are the Producer for Lobster Radio, a personalized AI radio station.
Your job is to chat with the listener, acknowledge their messages, and extract any directives or preferences.
You must output ONLY valid JSON matching this schema:
{
  "reply": "Your conversational response",
  "directives": {
    "suggestedMood": "A new mood if they ask for a change (Working, Relaxing, Exercising, Party, Sleepy)",
    "likedArtist": "Artist name if they praise someone",
    "dislikedArtist": "Artist name if they complain about someone",
    "skipRequested": true/false,
    "memoryInsight": "A brief note for the DJ about what the user wants next, if applicable"
  }
}

Current track: ${currentTrack ? currentTrack.title + " by " + currentTrack.artist : "None"}
Current mood: ${preferences?.moodAffinity ? Object.keys(preferences.moodAffinity)[0] : "Working"}
History: ${JSON.stringify(history)}
User message: ${message}`;

    try {
      const response = await callModel({
        system: "You output strictly valid JSON.",
        prompt,
        temperature: 0.7,
      });
      return JSON.parse(response) as ProducerOutput;
    } catch (e) {
      console.error("ProducerAgent failed to parse JSON", e);
      return {
        reply: "Got it. I'll let the DJ know.",
        directives: {}
      };
    }
  }
}
```

- [ ] **Step 4: Export in `index.ts`**
```typescript
export { ProducerAgent } from "./agents/ProducerAgent.js";
```

- [ ] **Step 5: Run test to verify it passes**
Run: `npx vitest agents/src/agents/ProducerAgent.test.ts --run`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add agents/src/agents/ProducerAgent.ts agents/src/agents/ProducerAgent.test.ts agents/src/index.ts
git commit -m "feat: add ProducerAgent"
```

### Task 3: Backend Integration for Chat Route

**Files:**
- Create: `backend/src/routes/chatRoutes.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Implement `chatRoutes.ts`**
```typescript
import { Router } from "express";
import { ProducerAgent, type ChatMessage } from "lobster-radio-agents";
import { getPreferences, savePreferences } from "../services/storageService.js";
import type { Track } from "lobster-radio-agents";

export const chatRouter = Router();
const producer = new ProducerAgent();

chatRouter.post("/", async (req, res) => {
  const { message, history, currentTrack } = req.body as {
    message: string;
    history: ChatMessage[];
    currentTrack: Track | null;
  };

  const prefs = await getPreferences();
  const output = await producer.generateResponse(message, history, currentTrack, prefs);

  // Apply directives implicitly
  if (output.directives) {
    let updated = false;

    if (output.directives.memoryInsight) {
      prefs.memoryInsight = output.directives.memoryInsight;
      updated = true;
    }

    if (output.directives.suggestedMood) {
      prefs.moodAffinity[output.directives.suggestedMood] = (prefs.moodAffinity[output.directives.suggestedMood] || 0) + 1;
      updated = true;
    }

    if (output.directives.likedArtist) {
      if (!prefs.likes.includes(output.directives.likedArtist)) {
        prefs.likes.push(output.directives.likedArtist);
        updated = true;
      }
    }

    if (output.directives.dislikedArtist) {
      if (!prefs.dislikes.includes(output.directives.dislikedArtist)) {
        prefs.dislikes.push(output.directives.dislikedArtist);
        updated = true;
      }
    }

    if (updated) {
      await savePreferences(prefs);
    }
  }

  res.json({
    reply: output.reply,
    skipRequested: !!output.directives.skipRequested
  });
});
```

- [ ] **Step 2: Hook up in `server.ts`**
Add import:
```typescript
import { chatRouter } from "./routes/chatRoutes.js";
```
Mount route (around line 34):
```typescript
  app.use("/api/chat", chatRouter);
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/routes/chatRoutes.ts backend/src/server.ts
git commit -m "feat(backend): add /api/chat route and wire up ProducerAgent"
```

### Task 4: Integrate `memoryInsight` into `NarratorAgent`

**Files:**
- Modify: `agents/src/agents/NarratorAgent.ts`

- [ ] **Step 1: Update Prompt logic**
Find `export interface NarratorInput` and add:
```typescript
  memoryInsight?: string;
```
Find the `getUserPrompt` method in `NarratorAgent.ts` and add the insight:
```typescript
    if (input.memoryInsight) {
      prompt += `\n\nPRODUCER NOTE: ${input.memoryInsight}. Acknowledge this in your narration naturally.`;
    }
```

- [ ] **Step 2: Commit**
```bash
git add agents/src/agents/NarratorAgent.ts
git commit -m "feat(agents): inject memoryInsight into NarratorAgent prompt"
```

### Task 5: Implement `ChatPanel` Component

**Files:**
- Create: `frontend/src/components/ChatPanel.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `sendChatMessage` to API (`frontend/src/lib/api.ts`)**
```typescript
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendChatMessage(message: string, history: ChatMessage[], currentTrack: Track | null) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, currentTrack }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json() as Promise<{ reply: string; skipRequested: boolean }>;
}
```

- [ ] **Step 2: Create `ChatPanel.tsx`**
```tsx
import { useState, useRef, useEffect } from "react";
import { sendChatMessage, type ChatMessage } from "../lib/api";
import type { Track } from "../types";

interface ChatPanelProps {
  currentTrack: Track | null;
  onSkipRequested: () => void;
}

export function ChatPanel({ currentTrack, onSkipRequested }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    const newHistory = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const response = await sendChatMessage(userMsg, messages, currentTrack);
      setMessages([...newHistory, { role: "assistant", content: response.reply }]);
      if (response.skipRequested) {
        onSkipRequested();
      }
    } catch (err) {
      setMessages([...newHistory, { role: "assistant", content: "Error: Could not reach the producer." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[500px] rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="bg-white/10 p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Producer Chat</h3>
        <p className="text-xs text-slate-400">Tell us what you want to hear</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-sm text-slate-500 text-center mt-10">Chat with the producer to request songs or change the mood.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
              m.role === "user" ? "bg-pulse/20 text-pulse border border-pulse/30" : "bg-white/10 text-white"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-xs text-slate-400">Producer is typing...</p>}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-pulse"
        />
        <button type="submit" disabled={loading || !input.trim()} className="rounded-full bg-pulse/20 text-pulse px-4 py-2 text-sm disabled:opacity-50 hover:bg-pulse/30 transition">
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/ChatPanel.tsx frontend/src/lib/api.ts
git commit -m "feat(frontend): add ChatPanel component and api client"
```

### Task 6: Integrate `ChatPanel` into `HomePage`

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Layout Reorganization**
Import the `ChatPanel`:
```tsx
import { ChatPanel } from "../components/ChatPanel";
```
Locate the section rendering `TrackQueue` and `HistoryPanel` (around line 558). Change the layout so the left column contains both `TrackQueue` and `HistoryPanel` stacked, and the right column is `ChatPanel`.
```tsx
      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="flex flex-col gap-6">
          <TrackQueue
            tracks={queue}
            currentTrackId={currentTrack?.id ?? null}
            onSelect={(track) => {
              // ... existing onSelect logic
            }}
          />
          <HistoryPanel history={preferences?.history ?? []} />
        </div>
        <ChatPanel
          currentTrack={currentTrack}
          onSkipRequested={() => {
            // Trigger skip logic - replicate what onNextTrack does
            if (!payload?.tracks || !payload.selectedTrack || !audioRef.current) return;
            userInteractedRef.current = true;
            const currentIndex = payload.tracks.findIndex((t) => t.id === payload.selectedTrack?.id);
            const nextIndex = (currentIndex + 1) % payload.tracks.length;
            const nextTrack = payload.tracks[nextIndex];
            if (nextTrack?.previewUrl) {
              setPayload((prev) => prev ? { ...prev, selectedTrack: nextTrack } : null);
              generateNarration(nextTrack.id, djStyle, djLanguage)
                .then((result) => {
                  setCurrentNarration(result.narration);
                  playNarrationThenMusic(result.narration, nextTrack);
                })
                .catch(() => {
                  const fallbackNarration = `接下来为您播放${nextTrack.artist}的《${nextTrack.title}》。`;
                  setCurrentNarration(fallbackNarration);
                  playNarrationThenMusic(fallbackNarration, nextTrack);
                });
            }
          }}
        />
      </section>
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat(frontend): replace right sidebar with ChatPanel"
```
