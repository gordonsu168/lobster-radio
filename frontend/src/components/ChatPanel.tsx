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

interface ChatPanelRef {
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
