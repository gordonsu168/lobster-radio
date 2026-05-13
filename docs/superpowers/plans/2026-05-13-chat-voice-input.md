# Chat Voice Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a long-press microphone button to the radio mode `ChatPanel` that uses the browser Web Speech API to transcribe user speech (in `djLanguage`) into the chat input box for the user to review and send.

**Architecture:** Pure frontend; new hook `useSpeechRecognition` wraps `window.SpeechRecognition` / `webkitSpeechRecognition`. `ChatPanel` adds a `MicButton` and accepts a `language` prop driven by `RadioModePage`'s `djLanguage` state. No new backend dependencies, no new packages.

**Tech Stack:** React 18, TypeScript, browser Web Speech API, Tailwind CSS.

**Reference Spec:** `docs/superpowers/specs/2026-05-13-chat-voice-input-design.md`

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `frontend/src/hooks/useSpeechRecognition.ts` | Create | Encapsulate Web Speech API: lifecycle, prefix handling, interim/final results, error mapping |
| `frontend/src/components/ChatPanel.tsx` | Modify | Add `language` prop, add inline `MicButton`, render interim transcript bubble, append final transcript to input |
| `frontend/src/pages/RadioModePage.tsx` | Modify | Pass `djLanguage` down to `ChatPanel` as `language` prop |

No test files: the project has no frontend test setup (only `agents/` has tests). Verification is manual + `npm run lint`.

---

## Task 1: Create the `useSpeechRecognition` hook

**Files:**
- Create: `frontend/src/hooks/useSpeechRecognition.ts`

- [ ] **Step 1: Verify the directory exists**

Run: `ls frontend/src/hooks 2>/dev/null || echo "missing"`
Expected: either a directory listing or `missing`. If `missing`, create it: `mkdir -p frontend/src/hooks`.

- [ ] **Step 2: Create the hook file**

Create `frontend/src/hooks/useSpeechRecognition.ts` with this exact content:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal types for Web Speech API (TS DOM lib does not include them).
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "network"
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "language-not-supported"
  | "unknown";

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isRecording: boolean;
  transcript: string;          // last final transcript
  interimTranscript: string;   // live partial transcript
  error: SpeechRecognitionErrorCode | null;
  start: (lang: string) => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const Ctor = getCtor();
  const isSupported = Ctor !== null;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<SpeechRecognitionErrorCode | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      // already stopped
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const start = useCallback(
    (lang: string) => {
      if (!Ctor) return;
      // If already recording, abort first to ensure single session.
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      setError(null);
      setInterimTranscript("");
      setTranscript("");

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalText += text;
          } else {
            interim += text;
          }
        }
        if (interim) setInterimTranscript(interim);
        if (finalText) {
          setTranscript((prev) => prev + finalText);
          setInterimTranscript("");
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = (event.error as SpeechRecognitionErrorCode) || "unknown";
        setError(code);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        setError("unknown");
        setIsRecording(false);
      }
    },
    [Ctor]
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      if (r) {
        try {
          r.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isRecording,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
```

- [ ] **Step 3: Type-check the hook**

Run: `npm run lint`
Expected: passes with no new errors. If it fails, fix the error and re-run.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useSpeechRecognition.ts
git commit -m "feat(frontend): add useSpeechRecognition hook wrapping Web Speech API"
```

---

## Task 2: Add `language` prop and `MicButton` to `ChatPanel`

**Files:**
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Replace the file with the updated component**

Open `frontend/src/components/ChatPanel.tsx`. Replace its entire content with the following:

```typescript
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { sendChatMessage, type ChatMessage } from "../lib/api";
import type { Track } from "../types";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

const SKIP_REQUEST_MESSAGE = "我想要跳过这首歌";
const MIN_PRESS_MS = 500;

interface ChatPanelProps {
  currentTrack: Track | null;
  onSkipRequested: () => void;
  onRefreshRequested?: () => void;
  onWikiReply?: (reply: string) => void;
  language?: string;
}

export interface ChatPanelRef {
  sendSkipRequest: () => void;
  addAssistantMessage: (content: string) => void;
}

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(
  ({ currentTrack, onSkipRequested, onRefreshRequested, onWikiReply, language = "zh-CN" }, ref) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pressStartRef = useRef<number>(0);

    const speech = useSpeechRecognition();

    async function handleSendMessage(content: string) {
      setMessages(prev => {
        const newHistory = [...prev, { role: "user" as const, content }];
        return newHistory;
      });
      setLoading(true);

      try {
        const currentMessages = messages;
        const response = await sendChatMessage(content, currentMessages, currentTrack);
        setMessages(prev => [...prev, { role: "assistant", content: response.reply }]);
        if (response.skipRequested) {
          onSkipRequested();
        }
        if (onRefreshRequested && response.toolResults?.some(t => t.name === "refreshRecommendations")) {
          onRefreshRequested();
        }
        if (onWikiReply && response.toolResults?.some(t => t.name === "fetchWikipedia") && response.reply) {
          onWikiReply(response.reply);
        }
      } catch (err) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not reach the producer." }]);
      } finally {
        setLoading(false);
      }
    }

    const handleSendSkipRequest = async () => {
      await handleSendMessage(SKIP_REQUEST_MESSAGE);
    };

    useImperativeHandle(ref, () => ({
      sendSkipRequest: handleSendSkipRequest,
      addAssistantMessage: (content: string) => {
        setMessages(prev => [...prev, { role: "assistant", content }]);
      }
    }), [handleSendSkipRequest]);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages]);

    // When a final transcript arrives, append it to the input box.
    useEffect(() => {
      if (!speech.transcript) return;
      setInput(prev => (prev ? `${prev} ${speech.transcript}` : speech.transcript));
      speech.reset();
      inputRef.current?.focus();
      // Move cursor to end on next tick.
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      });
    }, [speech.transcript]);

    // Map error codes to friendly Chinese hints.
    useEffect(() => {
      if (!speech.error) return;
      const map: Record<string, string> = {
        "not-allowed": "请在浏览器设置中允许麦克风",
        "service-not-allowed": "语音识别服务被拒绝，请检查浏览器设置",
        "network": "语音识别网络错误，请重试或手动输入",
        "no-speech": "",
        "aborted": "",
        "audio-capture": "无法访问麦克风设备",
        "language-not-supported": "当前浏览器不支持该识别语言",
        "unknown": "语音识别失败，请重试或手动输入",
      };
      const msg = map[speech.error] ?? "语音识别失败，请重试或手动输入";
      if (msg) setHint(msg);
    }, [speech.error]);

    // Auto-clear hint after 3 seconds.
    useEffect(() => {
      if (!hint) return;
      const id = window.setTimeout(() => setHint(null), 3000);
      return () => window.clearTimeout(id);
    }, [hint]);

    async function handleSend(e: React.FormEvent) {
      e.preventDefault();
      if (!input.trim() || loading) return;

      const userMsg = input.trim();
      setInput("");
      await handleSendMessage(userMsg);
    }

    function handleMicDown(e: React.PointerEvent<HTMLButtonElement>) {
      if (loading || !speech.isSupported) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressStartRef.current = Date.now();
      setHint(null);
      speech.start(language);
    }

    function handleMicUp(e: React.PointerEvent<HTMLButtonElement>) {
      if (!speech.isRecording) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const heldMs = Date.now() - pressStartRef.current;
      speech.stop();
      if (heldMs < MIN_PRESS_MS) {
        setHint("按住说话");
        speech.reset();
      }
    }

    function handleMicCancel(e: React.PointerEvent<HTMLButtonElement>) {
      if (!speech.isRecording) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      speech.stop();
      speech.reset();
    }

    const micDisabled = loading || !speech.isSupported;
    const micTitle = !speech.isSupported
      ? "当前浏览器不支持语音输入"
      : speech.isRecording
        ? "松开发送到输入框"
        : "按住说话";

    return (
      <div className="flex flex-col max-h-[40vh] rounded-2xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm">
        <div className="bg-white/10 p-2 border-b border-white/10 shrink-0">
          <h3 className="text-sm font-semibold text-white">Producer Chat</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="text-sm text-slate-500 text-center mt-4">Chat with the producer to request songs or change the mood.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-pulse/20 text-pulse border border-pulse/30" : "bg-white/10 text-white"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-slate-400">Producer is typing...</p>}
        </div>

        {/* Voice status bubble */}
        {(speech.isRecording || speech.interimTranscript || hint) && (
          <div className="px-3 pt-2 shrink-0">
            <div
              className={`rounded-xl px-3 py-2 text-xs ${
                hint
                  ? "bg-rose-500/15 text-rose-200 border border-rose-400/30"
                  : "bg-pulse/15 text-pulse border border-pulse/30"
              }`}
            >
              {hint
                ? hint
                : speech.interimTranscript
                  ? `正在听… ${speech.interimTranscript}`
                  : "正在听…"}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-pulse"
          />
          <button
            type="button"
            disabled={micDisabled}
            title={micTitle}
            aria-label={micTitle}
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={handleMicCancel}
            onPointerCancel={handleMicCancel}
            className={`rounded-full px-4 py-2 text-sm transition select-none ${
              speech.isRecording
                ? "bg-rose-500/30 text-rose-100 border border-rose-400/50 animate-pulse"
                : "bg-white/10 text-white hover:bg-white/20"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            🎤
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-pulse/20 text-pulse px-4 py-2 text-sm disabled:opacity-50 hover:bg-pulse/30 transition"
          >
            Send
          </button>
        </form>
      </div>
    );
  }
);

export { ChatPanel };
export type { ChatPanelRef };
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: passes with no new errors. If it fails, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx
git commit -m "feat(chat): add long-press mic button with Web Speech API to ChatPanel"
```

---

## Task 3: Wire `djLanguage` from `RadioModePage` to `ChatPanel`

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx:711-717`

- [ ] **Step 1: Update the `<ChatPanel>` JSX usage**

Find this block in `frontend/src/pages/RadioModePage.tsx` (around line 711):

```tsx
<ChatPanel
  ref={chatPanelRef}
  currentTrack={currentTrack}
  onSkipRequested={onSkipRequested}
  onRefreshRequested={handleRefresh}
  onWikiReply={playWikiReply}
/>
```

Replace it with:

```tsx
<ChatPanel
  ref={chatPanelRef}
  currentTrack={currentTrack}
  onSkipRequested={onSkipRequested}
  onRefreshRequested={handleRefresh}
  onWikiReply={playWikiReply}
  language={djLanguage}
/>
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: passes with no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "feat(radio): pass djLanguage to ChatPanel for voice input recognition"
```

---

## Task 4: Manual verification

No code changes; this is a checklist run against `npm run dev`.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open http://localhost:5173 in Chrome.

- [ ] **Step 2: Verify supported browser flow (Chrome)**

In the radio mode page:
1. Press and hold 🎤 button — button turns red and pulses; "正在听…" bubble appears above the input form.
2. Speak a short phrase in Mandarin — interim text appears in the bubble.
3. Release the button — final text appears in the input box, cursor focused at end, bubble disappears.
4. Edit the text if desired, then press Send — message goes to producer normally.

- [ ] **Step 3: Verify language switching**

In Settings page, change "DJ 语言" to "粤语 Cantonese" (`zh-HK`). Save. Return to radio mode. Long-press 🎤 and speak Cantonese — recognition should match.
Repeat with "英语 English" (`en-US`).

- [ ] **Step 4: Verify mis-tap (<500 ms) is discarded**

Quickly tap and release the mic button. Expected: hint "按住说话" appears for ~3 s; input box unchanged.

- [ ] **Step 5: Verify producer-loading disables mic**

Send a message; while "Producer is typing..." is shown, the 🎤 button must be disabled (40% opacity, not clickable).

- [ ] **Step 6: Verify unsupported browser**

Open the same URL in Firefox. The 🎤 button must be disabled with tooltip "当前浏览器不支持语音输入".

- [ ] **Step 7: Verify permission denial**

In Chrome, revoke microphone permission for localhost (Site Settings → Microphone → Block). Reload, attempt long-press. Expected: hint shows "请在浏览器设置中允许麦克风".

- [ ] **Step 8: Verify continuous append**

Long-press 🎤, say "你好"; release. Long-press again, say "今天天气好"; release. Expected: input shows "你好 今天天气好".

- [ ] **Step 9: Final lint check**

Run: `npm run lint`
Expected: clean.

---

## Self-Review Notes

- Spec coverage: hook (Task 1), MicButton + interim bubble + error mapping + min-press + append (Task 2), language wiring (Task 3), all 8 manual checks from spec mapped to Task 4 ✅
- Placeholder scan: no TBD/TODO; every code step contains complete code ✅
- Type consistency: `start(lang)`, `stop()`, `reset()`, `transcript`, `interimTranscript`, `isSupported`, `isRecording`, `error` used identically in hook and ChatPanel ✅
- Property name consistency: `language` prop used in both ChatPanel signature and RadioModePage call site ✅
