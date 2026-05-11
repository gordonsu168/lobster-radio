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