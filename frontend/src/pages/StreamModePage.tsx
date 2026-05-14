import { useEffect, useRef, useState } from "react";
import { SignalIcon, PlayIcon, PauseIcon } from "@heroicons/react/24/solid";
import { getSettings } from "../lib/api";
import type { Track, VoiceOption, DJStyle } from "../types";

type AudioQueueItem = {
  type: 'dj' | 'music';
  src: string;
  title?: string;
  artist?: string;
};

export function StreamModePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [voice, setVoice] = useState<VoiceOption>("alloy");
  const [djStyle, setDjStyle] = useState<DJStyle>("classic");
  const [djLanguage, setDjLanguage] = useState<string>("zh-CN");
  
  const [messages, setMessages] = useState<{sender: 'user' | 'dj', text: string}[]>([]);
  const [inputText, setInputText] = useState("");
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const isFetchingRef = useRef(false);
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const currentItemTypeRef = useRef<'dj' | 'music' | null>(null);

  useEffect(() => {
    getSettings().then(settings => {
      if (settings.voice) setVoice(settings.voice);
      if (settings.djStyle) setDjStyle(settings.djStyle);
      if (settings.djLanguage) setDjLanguage(settings.djLanguage);
    });
  }, []);

  const playNextInQueue = () => {
    if (!audioRef.current || audioQueueRef.current.length === 0) {
      if (currentItemTypeRef.current === 'music') {
         // Music ended and queue empty -> fetch next segment
         fetchNextSegment();
      }
      return;
    }

    const nextItem = audioQueueRef.current.shift()!;
    currentItemTypeRef.current = nextItem.type;
    
    console.log(`🎵 Playing next in queue: ${nextItem.type} - ${nextItem.title || 'voice'}`);
    audioRef.current.src = nextItem.src;
    audioRef.current.load();
    audioRef.current.play().catch(e => {
        console.error("Playback error:", e);
        // If play fails, try next one
        playNextInQueue();
    });
  };

  const fetchNextSegment = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      console.log("📡 Fetching next DJ segment from server...");
      const userHistory = messages.filter(m => m.sender === 'user').slice(-3).map(m => m.text).join(" ");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const res = await fetch('http://localhost:4000/api/stream/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          historyContext: userHistory,
          lastTrackId: currentTrack?.id,
          style: djStyle,
          language: djLanguage
        })
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (data.dj_text) {
        setMessages(prev => [...prev, { sender: 'dj', text: data.dj_text }]);
      }

      // Prepare queue
      const newQueue: AudioQueueItem[] = [];

      // 1. Add DJ Talk
      if (data.dj_audio_base64) {
        const mimeType = data.dj_audio_mime_type || 'audio/mp3';
        newQueue.push({
          type: 'dj',
          src: `data:${mimeType};base64,${data.dj_audio_base64}`,
          title: "DJ Comment"
        });
      }

      // 2. Add Music
      if (data.next_track) {
        setCurrentTrack(data.next_track);
        if (data.next_track.previewUrl) {
          newQueue.push({
            type: 'music',
            src: data.next_track.previewUrl,
            title: data.next_track.title,
            artist: data.next_track.artist
          });
        }
      }

      audioQueueRef.current = newQueue;
      playNextInQueue();
      
    } catch (e) {
      console.error("Failed to fetch stream segment:", e);
      setIsPlaying(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      if (audioQueueRef.current.length === 0 && !currentItemTypeRef.current) {
        fetchNextSegment();
      } else {
        audioRef.current?.play();
      }
    } else {
      setIsPlaying(false);
      audioRef.current?.pause();
    }
  };

  const handleTrackEnded = () => {
    console.log(`✅ Finished playing: ${currentItemTypeRef.current}`);
    playNextInQueue();
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Player Area */}
      <div className="flex-1 shrink-0 flex flex-col gap-6">
        <div className="rounded-[32px] border border-white/10 bg-black/20 p-8 backdrop-blur text-center flex flex-col items-center shadow-2xl">
          <SignalIcon className={`h-20 w-20 text-pulse mb-6 ${isPlaying ? 'animate-pulse' : 'opacity-30'}`} />
          <h2 className="text-3xl font-bold mb-2">DJ Stream Mode</h2>
          <p className="text-mist mb-8">AI-Powered Continuous Broadcast</p>

          <div className="w-full max-w-md bg-white/5 rounded-3xl p-8 mb-8 border border-white/10 min-h-[160px] flex flex-col justify-center text-left relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-pulse/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {currentTrack ? (
              <div className="relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pulse mb-2 block">Now Playing</span>
                <h3 className="text-2xl font-bold line-clamp-1 mb-1">{currentTrack.title}</h3>
                <p className="text-mist text-lg line-clamp-1">{currentTrack.artist}</p>
                <div className="mt-4 flex items-center gap-2">
                   <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-pulse transition-all duration-1000 ${isPlaying ? 'w-full opacity-30' : 'w-0'}`}></div>
                   </div>
                </div>
              </div>
            ) : (
              <p className="text-mist text-center italic animate-pulse">Waiting for the DJ to take the stage...</p>
            )}
          </div>

          <button 
            onClick={togglePlay}
            className="rounded-full bg-white text-black p-8 hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] z-20"
          >
            {isPlaying ? <PauseIcon className="h-12 w-12" /> : <PlayIcon className="h-12 w-12 ml-1" />}
          </button>
          
          <audio 
            ref={audioRef} 
            onEnded={handleTrackEnded} 
            onError={(e) => console.error("Audio Element Error:", e)}
          />
        </div>
      </div>

      {/* Chat / DJ Log Area */}
      <div className="w-full lg:w-[450px] shrink-0 flex flex-col gap-4">
        <div className="flex-1 rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur flex flex-col h-[650px] shadow-xl">
          <header className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${isPlaying ? '' : 'hidden'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-red-500' : 'bg-white/10'}`}></span>
                </span>
                Live Room
            </h3>
            <span className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-mist uppercase font-bold tracking-widest">On Air</span>
          </header>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 flex flex-col scroll-smooth">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-white/10 space-y-4">
                <SignalIcon className="h-12 w-12" />
                <p className="italic text-sm text-center px-10">Connection established. Start playing to see DJ conversation.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`p-4 rounded-2xl max-w-[90%] animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.sender === 'dj' ? 'bg-white/5 border-l-4 border-pulse text-white self-start' : 'bg-white/10 self-end ml-auto'}`}>
                <p className="text-[10px] font-black uppercase tracking-tighter text-white/30 mb-2">{msg.sender === 'dj' ? '🎙️ DJ Xiaolong' : '👤 Listener'}</p>
                <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => {
              e.preventDefault();
              if (!inputText.trim()) return;
              setMessages(prev => [...prev, { sender: 'user', text: inputText }]);
              setInputText("");
          }} className="relative">
            <input 
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Talk to the DJ..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 pr-20 text-sm focus:outline-none focus:border-pulse/50 focus:bg-white/10 transition-all placeholder:text-white/10"
            />
            <button 
              type="submit" 
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white text-black rounded-xl px-4 py-2 text-xs font-bold hover:bg-pulse transition-all disabled:opacity-30 disabled:grayscale"
              disabled={!inputText.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
