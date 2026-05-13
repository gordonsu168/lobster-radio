import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { sendChatMessage, type ChatMessage, type ToolResult } from "../lib/api";
import type { Track } from "../types";

const SKIP_REQUEST_MESSAGE = "我想要跳过这首歌";

interface ChatPanelProps {
  currentTrack: Track | null;
  onSkipRequested: () => void;
  onRefreshRequested?: () => void;
  onWikiReply?: (reply: string) => void;
}

export interface ChatPanelRef {
  sendSkipRequest: () => void;
  addAssistantMessage: (content: string) => void;
}

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({ currentTrack, onSkipRequested, onRefreshRequested, onWikiReply }, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function handleSendMessage(content: string) {
    // Use functional update to avoid stale closure
    setMessages(prev => {
      const newHistory = [...prev, { role: "user" as const, content }];
      return newHistory;
    });
    setLoading(true);

    try {
      // Get current messages before the request
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    await handleSendMessage(userMsg);
  }

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
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
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
});

export { ChatPanel };
export type { ChatPanelRef };