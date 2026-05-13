# Decouple Narration from Playlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor radio mode playback to decouple song playlist from narration playback -切歌不打断旁白，并且切歌完全由 AI DJ 控制。

**Architecture:** Each narration (intro/outro) gets its own independent `HTMLAudioElement` instance. Music uses a single dedicated audio instance.切歌 doesn't interrupt already-playing narrations. Skip button just sends a message to AI DJ instead of immediately cutting.

**Tech Stack:** React 18, TypeScript, HTML5 Audio API.

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/pages/RadioModePage.tsx` | Major refactor | Add active narration tracking, change `playNarrationThenMusic` and `playOutroThenNext` to use independent audio instances, change `handleSkip` behavior |
| `frontend/src/components/ChatPanel.tsx` | Minor change | Use `useImperativeHandle` to expose a method for triggering message sending |

---

## Task 1: Add Narration Instance Tracking to RadioModePage

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx`

- [ ] **Step 1: Add NarrationInstance interface and ref to RadioModePage**

Add this after the existing ref declarations around line 38:

```typescript
interface NarrationInstance {
  audio: HTMLAudioElement;
}

const activeNarrationsRef = useRef<NarrationInstance[]>([]);
```

- [ ] **Step 2: Add helper methods to manage narration instances**

Add these helper functions after the existing ref declarations:

```typescript
function addNarration(audio: HTMLAudioElement): void {
  activeNarrationsRef.current.push({ audio });
}

function removeNarration(audio: HTMLAudioElement): void {
  activeNarrationsRef.current = activeNarrationsRef.current.filter(
    instance => instance.audio !== audio
  );
}

function forEachNarration(callback: (audio: HTMLAudioElement) => void): void {
  activeNarrationsRef.current.forEach(instance => callback(instance.audio));
}

function cleanupNarration(audio: HTMLAudioElement, url: string): void {
  audio.pause();
  removeNarration(audio);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "refactor(radio): add narration instance tracking"
```

---

## Task 2: Refactor playNarrationThenMusic to use independent audio instance

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx:241-310`

Current: Uses shared `audioRef.current` for narration. Change to create a new audio instance.

- [ ] **Step 1: Rewrite playNarrationThenMusic**

Replace the entire `playNarrationThenMusic` function:

```typescript
// 播放旁白然后音乐 - 旁白使用独立 audio 实例
const playNarrationThenMusic = async (narrationText: string, track: Track): Promise<void> => {
  return new Promise((resolve) => {
    if (!audioRef.current || !track.previewUrl) {
      resolve();
      return;
    }

    userInteractedRef.current = true;
    audioRef.current.pause();

    const playMusicAfterNarration = () => {
      if (audioRef.current && track.previewUrl) {
        audioRef.current.src = track.previewUrl;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      resolve();
    };

    synthesizeNarration(narrationText, voice, { emotion: djEmotion, language: djLanguage })
      .then(response => {
        if (response.audioBase64) {
          const binary = atob(response.audioBase64);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
          const url = URL.createObjectURL(blob);

          // Create independent audio instance for this narration
          const narrationAudio = new Audio(url);
          narrationAudio.crossOrigin = "anonymous";
          addNarration(narrationAudio);

          const handleEnded = () => {
            cleanupNarration(narrationAudio, url);
            playMusicAfterNarration();
          };

          const handleError = () => {
            cleanupNarration(narrationAudio, url);
            playMusicAfterNarration();
          };

          narrationAudio.addEventListener("ended", handleEnded, { once: true });
          narrationAudio.addEventListener("error", handleError, { once: true });
          narrationAudio.play().catch(handleError);
        } else {
          // No narration, play music directly
          playMusicAfterNarration();
        }
      })
      .catch(() => {
        // Error playing narration, skip directly to music
        if (audioRef.current && track.previewUrl) {
          audioRef.current.src = track.previewUrl;
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
        resolve();
      });
  });
};
```

**Key changes from original:**
- Uses `new Audio(url)` instead of shared `audioRef`
- Tracks instance in `activeNarrationsRef`
- Cleans up after completion/error
- Same high-level flow (wait for narration before playing music) still works

- [ ] **Step 2: Remove old `isNarrationPlayingRef` usage where no longer needed**

Check the `useEffect` that starts playback around line 95-99. It currently has `isNarrationPlayingRef.current` in condition. Remove that since we don't need it anymore - we only check if a narration is playing on the shared music audio.

The useEffect should look like:

```typescript
// 当 currentTrack 被设置且还没有开始播放时，自动开始播放
// 使用函数式更新确保拿到最新的状态
useEffect(() => {
  if (!currentTrack || !currentNarration || isPlaying) {
    return;
  }
  playNarrationThenMusic(currentNarration, currentTrack);
}, [currentTrack, currentNarration, isPlaying]);
```

Also remove from `handleTrackEnd` around line 105:

```typescript
const handleTrackEnd = async () => {
  if (isLoadingNextRef.current) {
    return;
  }

  isLoadingNextRef.current = true;

  try {
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
  } finally {
    isLoadingNextRef.current = false;
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "refactor(radio): refactor playNarrationThenMusic to use independent audio"
```

---

## Task 3: Refactor playOutroThenNext to use independent audio instance

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx:312-366`

**Important behavior change:** Originally outro had to finish playing before next track started. **Now music starts immediately**, outro continues playing in background.

- [ ] **Step 1: Rewrite playOutroThenNext**

Replace the entire function:

```typescript
// 播放 outro 闲聊，音乐立即切到下一首，outro 在后台继续播放
const playOutroThenNext = async (outroText: string): Promise<void> => {
  return new Promise((resolve) => {
    // Generate outro audio immediately
    synthesizeNarration(outroText, voice, { emotion: djEmotion, language: djLanguage })
      .then(response => {
        if (response.audioBase64 && audioRef.current) {
          const binary = atob(response.audioBase64);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
          const url = URL.createObjectURL(blob);

          // Create independent audio instance for outro
          const outroAudio = new Audio(url);
          outroAudio.crossOrigin = "anonymous";
          addNarration(outroAudio);

          const handleEnded = () => {
            cleanupNarration(outroAudio, url);
            resolve();
          };

          const handleError = () => {
            cleanupNarration(outroAudio, url);
            resolve();
          };

          outroAudio.addEventListener("ended", handleEnded, { once: true });
          outroAudio.addEventListener("error", handleError, { once: true });
          outroAudio.play().catch(handleError);
        } else {
          resolve();
        }
      })
      .catch(() => {
        // Even if outro fails, resolve immediately
        resolve();
      });

    // KEY CHANGE: Immediately start next track without waiting for outro to finish
    playNextTrack();
  });
};
```

**Key change:** 调用 `playNextTrack()` immediately，不需要等 outro 播完。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "refactor(radio): refactor playOutroThenNext to independent audio"
```

---

## Task 4: Update handlePlayPause to sync with all narrations

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx:455-469`

- [ ] **Step 1: Update handlePlayPause**

Replace the function:

```typescript
// 播放暂停 - 同步作用于音乐和所有正在播放的旁白
const handlePlayPause = () => {
  if (!audioRef.current || !currentTrack?.previewUrl) return;

  if (isPlaying) {
    audioRef.current.pause();
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    // Pause all active narrations
    forEachNarration(audio => audio.pause());
    setIsPlaying(false);
  } else {
    audioRef.current.play().catch(e => console.warn("Play error:", e));
    // Resume all active narrations
    forEachNarration(audio => audio.play().catch(() => {}));
    setIsPlaying(true);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "feat(radio): sync pause/play across all narrations"
```

---

## Task 5: Update ChatPanel to allow external trigger of skip message

**Files:**
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Update imports and useImperativeHandle**

Add `useImperativeHandle` and `forwardRef`:

```typescript
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
```

Change the component definition:

```typescript
export interface ChatPanelRef {
  sendSkipRequest: () => void;
}

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({ currentTrack, onSkipRequested, onRefreshRequested }, ref) => {
```

- [ ] **Step 2: Add state and expose sendSkipRequest method**

Inside the component, after the existing state declarations, add:

```typescript
useImperativeHandle(ref, () => ({
  sendSkipRequest: () => {
    handleSendSkipRequest();
  }
}));

async function handleSendSkipRequest() {
  const skipMessage = "我想要跳过这首歌";
  const newHistory = [...messages, { role: "user" as const, content: skipMessage }];
  setMessages(newHistory);
  setLoading(true);

  try {
    const response = await sendChatMessage(skipMessage, messages, currentTrack);
    setMessages([...newHistory, { role: "assistant", content: response.reply }]);
    if (response.skipRequested) {
      onSkipRequested();
    }
    if (onRefreshRequested && response.toolResults?.some(t => t.name === "refreshRecommendations")) {
      onRefreshRequested();
    }
  } catch (err) {
    setMessages([...newHistory, { role: "assistant", content: "Error: Could not reach the producer." }]);
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 3: Close component and export**

Close the component, update export:

```typescript
});

export { ChatPanel };
export type { ChatPanelRef };
```

- [ ] **Step 4: Update RadioModePage to use the ref**

In `frontend/src/pages/RadioModePage.tsx` add the ref to ChatPanel:

First add import at top:

```typescript
import { ChatPanel, type ChatPanelRef } from "../components/ChatPanel";
```

Add ref in RadioModePage component with other refs:

```typescript
const chatPanelRef = useRef<ChatPanelRef>(null);
```

In the JSX:

```typescript
<ChatPanel
  ref={chatPanelRef}
  currentTrack={currentTrack}
  onSkipRequested={handleSkip}
  onRefreshRequested={handleRefresh}
/>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx frontend/src/pages/RadioModePage.tsx
git commit -m "feat(chat): expose sendSkipRequest from ChatPanel"
```

---

## Task 6: Change handleSkip behavior to send message instead of immediate skip

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx:471-492`

- [ ] **Step 1: Rewrite handleSkip**

Replace the entire function:

```typescript
// 用户点击跳过按钮 - 发送请求给 AI DJ，由 DJ 决定何时切歌
const handleSkip = () => {
  // 只发送消息，不立即切歌。AI DJ 会在合适时机调用 onSkipRequested 切歌
  chatPanelRef.current?.sendSkipRequest();
};
```

**Note:** The AI DJ will still get the `skipRequested` from the chat response, and that will trigger `handleSkip` again? No - actually when AI responds with `skipRequested: true` from the chat, it will call `onSkipRequested()` which is `handleSkip`. Wait - this creates a loop.

Fix: We need to rename the actual切歌 function to `actuallySkipTrack` and have `handleSkip` just send message.

Do:

1. Keep `handleSkip` as the one that sends message
2. Rename the original切歌 logic to `actuallySkipTrack`
3. When AI gets `skipRequested: true` in ChatPanel, it calls `actuallySkipTrack`

So update the RadioModePage:

Around line 471:

```typescript
// 用户点击跳过按钮 - 发送请求给 AI DJ，由 DJ 决定何时切歌
const handleSkip = () => {
  chatPanelRef.current?.sendSkipRequest();
};

// AI DJ 请求切歌 - 实际执行切歌操作
const actuallySkipTrack = async () => {
  if (isLoadingNextRef.current) return;

  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = "";
    audioRef.current.load();
  }

  // Music stops immediately, active narrations continue playing
  // Narrations are not interrupted - this is the whole point of the refactor!

  isLoadingNextRef.current = true;
  try {
    await playNextTrack();
  } finally {
    isLoadingNextRef.current = false;
  }
};
```

In the ChatPanel prop, change the prop name:

```typescript
<ChatPanel
  ref={chatPanelRef}
  currentTrack={currentTrack}
  onSkipRequested={actuallySkipTrack}
  onRefreshRequested={handleRefresh}
/>
```

And the props type: ChatPanel already accepts `onSkipRequested: () => void` which is what we have.

- [ ] **Step 2: Fix useEffect that calls `playNarrationThenMusic` - check that it's correct**

It's already okay: `currentTrack` changes trigger it, that's correct because when `playNextTrack` sets `currentTrack`, it will start the intro.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "feat(radio): change skip button to send message to AI DJ"
```

---

## Task 7: Cleanup unneeded variables

**Files:**
- Modify: `frontend/src/pages/RadioModePage.tsx`

- [ ] **Step 1: Remove isNarrationPlayingRef since it's no longer used**

Remove the line:

```typescript
// DELETE: const isNarrationPlayingRef = useRef(false);
```

And remove any other references. Check `playNextTrack` line 191 where it sets `isNarrationPlayingRef.current = true;` - that's not needed anymore, delete that line.

- [ ] **Step 2: Verify no other references to isNarrationPlayingRef**

Grep for it - should find nothing left.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RadioModePage.tsx
git commit -m "cleanup(radio): remove unused isNarrationPlayingRef"
```

---

## Task 8: Test and verify behavior

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test normal flow (no skipping)**

- Open `/radio`
- Verify intro plays → then music plays → no issues
- Verify when music ends, outro starts playing and next music starts immediately
- Verify outro continues playing while next song is already playing
- Verify mid-track trivia still works (it already uses separate audio)

- [ ] **Step 3: Test skip behavior**

- While intro is playing, click Skip
- Verify intro continues playing to completion
- Verify skip request is sent to chat, AI responds, and after intro finishes music starts correctly
- Verify no overlapping music

- [ ] **Step 4: Test pause/play sync**

- While music and a narration are both playing
- Click Pause → both pause
- Click Play → both resume

- [ ] **Step 5: Check for memory leaks**

- Multiple skips, multiple narrations playing concurrently
- Verify after playback completes, instances are removed from activeNarrations

---

## Final Check

All requirements from spec should be covered:

- [x] 用户点击跳过按钮只发消息给 AI DJ，不立即切歌
- [x] AI DJ 请求切歌时，intro 继续播放完不被打断
- [x] AI DJ 请求切歌时，outro 继续播放完不被打断
- [x] 点击暂停，音乐和所有旁白都暂停
- [x] 点击播放，音乐和所有旁白都恢复
- [x] 旁白播放完后正确清理资源
- [x] mid-track trivia 保持不变
- [x] 正常播放流程行为和原来一致
