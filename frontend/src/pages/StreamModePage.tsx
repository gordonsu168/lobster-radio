import { useEffect, useRef, useState } from "react";
import { SignalIcon, PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import { getSettings } from "../lib/api";
import { TrackQueue } from "../components/TrackQueue";
import { cleanupNarrationAudio } from "../lib/audioUtils";
import type { Track, DJStyle } from "../types";

type MidSongInsert = {
  text: string;
  audioBase64: string;
  mimeType: string;
  timing: 'early' | 'middle' | 'late';
  type: 'trivia' | 'commentary' | 'listener_response';
};

type ThemeContext = {
  theme: string;
  phase: 'intro' | 'deep_dive' | 'reflection' | 'twist' | 'outro';
  segmentIndex: number;
  coveredTopics: string[];
};

const TIMING_PROGRESS: Record<string, number> = {
  early: 0.25,
  middle: 0.52,
  late: 0.76,
};

const MUSIC_DUCK_VOLUME = 0.15;

export function StreamModePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [voice, setVoice] = useState<string>("alloy");
  const [djStyle, setDjStyle] = useState<DJStyle>("classic");
  const [djLanguage, setDjLanguage] = useState<string>("zh-CN");

  const [messages, setMessages] = useState<{sender: 'user' | 'dj', text: string}[]>([]);
  const [inputText, setInputText] = useState("");
  const [themeContext, setThemeContext] = useState<ThemeContext | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const isFetchingRef = useRef(false);
  const isNarrationPlayingRef = useRef(false);
  const narrationUrlRef = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Show button if we're more than 100px from bottom
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Overlay narration (mid-song inserts)
  const activeOverlayAudiosRef = useRef<HTMLAudioElement[]>([]);
  const midSongInsertsRef = useRef<MidSongInsert[]>([]);
  const insertsTriggeredRef = useRef<Set<number>>(new Set());
  const pendingTrackRef = useRef<Track | null>(null);
  const savedVolumeRef = useRef(1.0);

  // Pre-fetch
  const prefetchedDataRef = useRef<any>(null);
  const prefetchTriggeredRef = useRef(false);

  useEffect(() => {
    getSettings().then(settings => {
      if (settings.defaultVoice) setVoice(settings.defaultVoice);
      if (settings.djStyle) setDjStyle(settings.djStyle);
      if (settings.djLanguage) setDjLanguage(settings.djLanguage);
    });

    return () => {
      if (narrationUrlRef.current) URL.revokeObjectURL(narrationUrlRef.current);
      cleanupAllOverlays();
    };
  }, []);

  // --- Overlay audio helpers ---

  const addOverlayAudio = (audio: HTMLAudioElement) => {
    activeOverlayAudiosRef.current.push(audio);
  };

  const removeOverlayAudio = (audio: HTMLAudioElement) => {
    activeOverlayAudiosRef.current = activeOverlayAudiosRef.current.filter(
      instance => instance !== audio
    );
  };

  const cleanupAllOverlays = () => {
    activeOverlayAudiosRef.current.forEach(a => {
      a.pause();
      a.src = '';
    });
    activeOverlayAudiosRef.current = [];
  };

  const duckMainVolume = () => {
    if (audioRef.current) {
      savedVolumeRef.current = audioRef.current.volume;
      audioRef.current.volume = MUSIC_DUCK_VOLUME;
    }
  };

  const restoreMainVolume = () => {
    if (audioRef.current) {
      audioRef.current.volume = savedVolumeRef.current;
    }
  };

  // --- Narration playback ---

  const triggerMidSongInsert = (insert: MidSongInsert) => {
    if (!audioRef.current) return;

    setMessages(prev => [...prev, { sender: 'dj', text: `🎙️ ${insert.text}` }]);
    duckMainVolume();

    // Mid-song inserts use separate Audio objects because they play simultaneously
    try {
      const binary = atob(insert.audioBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: insert.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audio.volume = Math.min(1.0, savedVolumeRef.current * 2.5);

      const finish = () => {
        cleanupNarrationAudio(audio, url);
        removeOverlayAudio(audio);
        if (activeOverlayAudiosRef.current.length === 0) {
          restoreMainVolume();
        }
      };

      audio.onended = finish;
      audio.onerror = finish;

      addOverlayAudio(audio);
      audio.play().catch(console.warn);
    } catch (e) {
      console.error("Failed to play mid-song insert:", e);
      restoreMainVolume();
    }
  };

  const playDJIntroThenSong = (djBase64: string | null, djMimeType: string, track: Track) => {
    if (!audioRef.current) return;

    pendingTrackRef.current = track;

    const startMusic = () => {
      if (!audioRef.current) return;
      const t = pendingTrackRef.current;
      if (!t || !t.previewUrl) {
        console.warn("[stream] No pending track or previewUrl, skipping...");
        setStatus("Skipping missing track");
        fetchNextSegment();
        return;
      }

      console.log("--------------------------------------------------");
      console.log("[stream] 🎵 STARTING MUSIC PLAYBACK");
      console.log("[stream] Title:", t.title);
      console.log("[stream] Artist:", t.artist);
      console.log("[stream] SRC being set:", t.previewUrl);
      console.log("--------------------------------------------------");

      setStatus(`Playing: ${t.title}`);
      isNarrationPlayingRef.current = false;
      audioRef.current.src = t.previewUrl;
      audioRef.current.volume = 1.0;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          console.log("[stream] ▶️ Music started");
        })
        .catch(err => {
          console.error("[stream] ❌ Music playback blocked:", err);
          setStatus("Playback blocked - click to fix");
          setIsPlaying(false);
        });
      pendingTrackRef.current = null;
    };

    if (!djBase64) {
      console.log("[stream] No DJ intro, starting music immediately");
      startMusic();
      return;
    }

    // Clean up previous narration URL
    if (narrationUrlRef.current) {
      URL.revokeObjectURL(narrationUrlRef.current);
      narrationUrlRef.current = null;
    }

    try {
      console.log("[stream] 🎙️ Preparing DJ narration...");
      setStatus("Loading DJ...");
      const binary = atob(djBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: djMimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      narrationUrlRef.current = url;

      // REUSE main audio element for narration to keep user gesture context alive!
      isNarrationPlayingRef.current = true;
      audioRef.current.src = url;
      audioRef.current.volume = 1.0;
      audioRef.current.play()
        .then(() => {
          console.log("[stream] 🎙️ DJ narration started");
          setStatus("DJ Speaking...");
        })
        .catch(e => {
          console.warn("[stream] 🎙️ DJ narration blocked, skipping to music:", e);
          startMusic();
        });
    } catch (e) {
      console.error("[stream] Failed to prepare narration:", e);
      startMusic();
    }
  };

  // --- Core flow ---

  const fetchInitData = async () => {
    setStatus("Connecting to DJ...");
    const res = await fetch('/api/stream/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style: djStyle, language: djLanguage })
    });
    if (!res.ok) throw new Error("Failed to init stream");
    return res.json();
  };

  const applyInitData = (data: any) => {
    console.log("[stream] init: theme =", data.theme_update?.theme);
    setStatus("Initializing stream...");

    if (data.theme_update) {
      setThemeContext({
        theme: data.theme_update.theme,
        phase: data.theme_update.phase,
        segmentIndex: 0,
        coveredTopics: data.theme_update.coveredTopics || []
      });
    }

    if (data.playlist) {
      setPlaylist(data.playlist);
    }

    if (data.first_segment) {
      if (data.first_segment.dj_text) {
        setMessages(prev => [...prev, { sender: 'dj', text: data.first_segment.dj_text }]);
      }
      if (data.first_segment.next_track) {
        console.log("--------------------------------------------------");
        console.log("[stream] RECEIVED FIRST TRACK DATA");
        console.log("[stream] Track:", data.first_segment.next_track.title, "by", data.first_segment.next_track.artist);
        console.log("[stream] ID:", data.first_segment.next_track.id);
        console.log("[stream] Preview URL:", data.first_segment.next_track.previewUrl);
        console.log("--------------------------------------------------");

        setCurrentTrack(data.first_segment.next_track);
        playDJIntroThenSong(
          data.first_segment.dj_audio_base64,
          data.first_segment.dj_audio_mime_type || 'audio/mp3',
          data.first_segment.next_track
        );
      }
    }
  };

  const fetchSegmentData = async () => {
    const historyContext = messages.slice(-10).map(m => `${m.sender === 'user' ? '听众' : 'DJ小龙'}: ${m.text}`).join("\n");

    const res = await fetch('/api/stream/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        historyContext: historyContext,
        lastTrackId: currentTrack?.id,
        style: djStyle,
        language: djLanguage,
        themeContext: themeContext || undefined
      })
    });
    if (!res.ok) throw new Error("Failed to fetch segment");
    return res.json();
  };

  const applySegmentData = (data: any) => {
    prefetchTriggeredRef.current = false;
    setStatus("Loading next...");

    if (data.dj_text) {
      setMessages(prev => [...prev, { sender: 'dj', text: data.dj_text }]);
    }

    if (data.theme_update) {
      setThemeContext(prev => ({
        theme: data.theme_update.theme,
        phase: data.theme_update.phase,
        segmentIndex: (prev?.segmentIndex ?? -1) + 1,
        coveredTopics: data.theme_update.coveredTopics || []
      }));
    }

    if (data.playlist) {
      setPlaylist(data.playlist);
    }

    // Store mid-song inserts
    if (data.mid_song_inserts && data.mid_song_inserts.length > 0) {
      midSongInsertsRef.current = data.mid_song_inserts.map((i: any) => ({
        text: i.text,
        audioBase64: i.audio_base64,
        mimeType: i.mime_type,
        timing: i.timing,
        type: i.type,
      }));
    }

    if (data.next_track) {
      console.log("--------------------------------------------------");
      console.log("[stream] RECEIVED NEXT TRACK DATA");
      console.log("[stream] Track:", data.next_track.title, "by", data.next_track.artist);
      console.log("[stream] ID:", data.next_track.id);
      console.log("[stream] Preview URL:", data.next_track.previewUrl);
      console.log("--------------------------------------------------");

      setCurrentTrack(data.next_track);
      cleanupAllOverlays();
      playDJIntroThenSong(data.dj_audio_base64, data.dj_audio_mime_type || 'audio/mp3', data.next_track);
    } else {
      setIsPlaying(false);
      setStatus("End of broadcast");
    }
  };

  const fetchNextSegment = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setStatus("Fetching next...");

    midSongInsertsRef.current = [];
    insertsTriggeredRef.current = new Set();

    try {
      let data: any;
      if (prefetchedDataRef.current) {
        data = prefetchedDataRef.current;
        prefetchedDataRef.current = null;
      } else {
        data = await fetchSegmentData();
      }
      applySegmentData(data);
    } catch (e) {
      console.error("Failed to fetch stream segment:", e);
      setStatus("Error loading segment");
    } finally {
      isFetchingRef.current = false;
    }
  };

  const prefetchNextSegment = () => {
    if (prefetchTriggeredRef.current || isFetchingRef.current) return;
    prefetchTriggeredRef.current = true;

    fetchSegmentData().then(data => {
      prefetchedDataRef.current = data;
      
      // Real-time update: Show the prefetched next track and updated playlist immediately
      if (data.next_track) {
        const nextPlaylist = [data.next_track];
        if (data.playlist && Array.isArray(data.playlist)) {
          nextPlaylist.push(...data.playlist);
        }
        setPlaylist(nextPlaylist);
      } else if (data.playlist && Array.isArray(data.playlist)) {
        setPlaylist(data.playlist);
      }
      
      console.log("📦 Pre-fetch complete, playlist updated");
    }).catch(e => {
      console.warn("Pre-fetch failed:", e);
      prefetchTriggeredRef.current = false;
    });
  };

  // --- Audio event handlers ---

  const handleTrackEnded = () => {
    if (isNarrationPlayingRef.current) {
      console.log("[stream] DJ Intro ended, switching to music...");
      isNarrationPlayingRef.current = false;
      
      const t = pendingTrackRef.current;
      if (t && t.previewUrl && audioRef.current) {
        console.log("--------------------------------------------------");
        console.log("[stream] 🎵 SWITCHING TO MUSIC (from narration)");
        console.log("[stream] Title:", t.title);
        console.log("[stream] Artist:", t.artist);
        console.log("[stream] SRC being set:", t.previewUrl);
        console.log("--------------------------------------------------");
        
        setStatus(`Playing: ${t.title}`);
        audioRef.current.src = t.previewUrl;
        audioRef.current.volume = 1.0;
        audioRef.current.play().catch(err => {
          console.error("[stream] Auto-play music blocked after narration:", err);
          setStatus("Music blocked - click Play");
          setIsPlaying(false);
        });
        pendingTrackRef.current = null;
      } else {
        fetchNextSegment();
      }
    } else {
      console.log("Track ended, loading next...");
      setStatus("Track ended");
      fetchNextSegment();
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || isNarrationPlayingRef.current) return;

    const duration = audioRef.current.duration;
    if (!duration || !isFinite(duration)) return;

    const progress = audioRef.current.currentTime / duration;

    if (progress >= 0.8) {
      prefetchNextSegment();
    }

    midSongInsertsRef.current.forEach((insert, index) => {
      if (insertsTriggeredRef.current.has(index)) return;
      const targetProgress = TIMING_PROGRESS[insert.timing];
      if (targetProgress !== undefined && progress >= targetProgress) {
        insertsTriggeredRef.current.add(index);
        triggerMidSongInsert(insert);
      }
    });
  };

  const isRequest = (text: string) => {
    const patterns = [/点歌/i, /我想听/i, /点一首/i, /播放/i, /点/i, /request/i];
    return patterns.some(p => p.test(text));
  };

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      setStatus("Starting...");
      
      if (audioRef.current) {
        audioRef.current.volume = 1.0;
        audioRef.current.muted = false;
        // Prime the audio element immediately
        audioRef.current.play().then(() => {
          if (!audioRef.current?.src) audioRef.current?.pause();
        }).catch(e => console.warn("Prime blocked:", e));
      }

      if (!currentTrack && !pendingTrackRef.current) {
        if (playlist.length === 0) {
          fetchInitData().then(applyInitData).catch(err => {
            console.error("Init failed:", err);
            setStatus("Failed to connect");
            setIsPlaying(false);
          });
        } else {
          fetchNextSegment();
        }
      } else if (audioRef.current?.src) {
        audioRef.current.play().catch(console.error);
        activeOverlayAudiosRef.current.forEach(a => a.play().catch(() => {}));
      } else {
        fetchNextSegment();
      }
    } else {
      setIsPlaying(false);
      setStatus("Paused");
      audioRef.current?.pause();
      activeOverlayAudiosRef.current.forEach(a => a.pause());
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row items-start">
      <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
        <div className="rounded-[32px] border border-white/10 bg-black/20 p-8 backdrop-blur text-center flex flex-col items-center shadow-2xl relative shrink-0">
          
          {/* Status Indicator */}
          <div className="absolute top-6 right-8 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold tracking-widest uppercase">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-pulse animate-pulse' : 'bg-white/20'}`}></div>
            <span className={isPlaying ? 'text-white' : 'text-white/40'}>{status}</span>
          </div>

          <SignalIcon className={`h-20 w-20 text-pulse mb-6 ${isPlaying ? 'animate-pulse' : 'opacity-30'}`} />
          <h2 className="text-3xl font-bold mb-2">DJ Stream Mode</h2>
          <p className="text-mist mb-4">AI-Powered Continuous Broadcast</p>

          {themeContext && (
            <div className="mb-6 px-4 py-2 rounded-full bg-pulse/10 border border-pulse/20 text-sm">
              <span className="text-pulse font-bold">{
                themeContext.phase === 'intro' ? '🎬' :
                themeContext.phase === 'deep_dive' ? '🔍' :
                themeContext.phase === 'reflection' ? '💭' :
                themeContext.phase === 'twist' ? '🔄' : '👋'
              }</span>
              <span className="text-white ml-2">{themeContext.theme}</span>
              <span className="text-white/30 ml-2 text-xs">· 第{themeContext.segmentIndex}段</span>
            </div>
          )}

          <div className="w-full max-w-md bg-white/5 rounded-3xl p-8 mb-8 border border-white/10 min-h-[160px] flex flex-col justify-center text-left relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-pulse/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {currentTrack ? (
              <div className="relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pulse mb-2 block">Now Playing</span>
                <h3 className="text-2xl font-bold line-clamp-1 mb-1">{currentTrack.title}</h3>
                <p className="text-mist text-lg line-clamp-1">{currentTrack.artist}</p>
                <div className="mt-4 flex items-center gap-2">
                   <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-pulse transition-all duration-1000 ${isPlaying ? (isNarrationPlayingRef.current ? 'w-1/3' : 'w-full opacity-30') : 'w-0'}`}></div>
                   </div>
                </div>
              </div>
            ) : (
              <p className="text-mist text-center italic animate-pulse">Waiting for the DJ to take the stage...</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-6">
            <button
              onClick={togglePlay}
              className="rounded-full bg-white text-black p-8 hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] z-20"
            >
              {isPlaying ? <PauseIcon className="h-12 w-12" /> : <PlayIcon className="h-12 w-12 ml-1" />}
            </button>
            
            {!isPlaying && currentTrack && (
               <p className="text-[10px] text-white/30 uppercase font-black tracking-tighter animate-bounce">Click to Play</p>
            )}
          </div>

          <audio
            ref={audioRef}
            onEnded={handleTrackEnded}
            onTimeUpdate={handleTimeUpdate}
            onError={(e) => {
               console.error("Audio Element Error:", e);
               setStatus("Audio Error");
            }}
          />
        </div>

        {playlist.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-[28px] flex flex-col overflow-hidden max-h-[600px]">
            <div className="overflow-y-auto custom-scrollbar">
              <TrackQueue
                tracks={playlist}
                currentTrackId={currentTrack?.id ?? null}
                compact={true}
                className="bg-transparent border-none shadow-none"
                onSelect={(track: Track) => {
                  // In stream mode, selecting a track from the queue triggers a skip
                  // and immediate play of that track.
                  if (isFetchingRef.current) return;
                  
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = "";
                    audioRef.current.load();
                  }
                  
                  // Remove this track and anything before it from the playlist
                  const idx = playlist.findIndex(t => t.id === track.id);
                  if (idx !== -1) {
                    setPlaylist(prev => prev.slice(idx + 1));
                  }
                  
                  setCurrentTrack(track);
                  cleanupAllOverlays();
                  playDJIntroThenSong(null, "audio/mp3", track);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full lg:w-[450px] shrink-0 flex flex-col min-h-[600px] h-[800px]">
        <div className="flex-1 rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur flex flex-col shadow-xl relative overflow-hidden">
          <header className="flex items-center justify-between mb-6 shrink-0">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${isPlaying ? '' : 'hidden'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-red-500' : 'bg-white/10'}`}></span>
                </span>
                Live Room
            </h3>
            <span className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-mist uppercase font-bold tracking-widest">On Air</span>
          </header>

          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 flex flex-col scroll-smooth min-h-0"
          >
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

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-8 bg-pulse text-white rounded-full p-3 shadow-lg hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in duration-300 z-30"
              title="Scroll to bottom"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </button>
          )}

          <form onSubmit={(e) => {
              e.preventDefault();
              if (!inputText.trim()) return;
              
              const text = inputText.trim();
              setMessages(prev => [...prev, { sender: 'user', text }]);
              setInputText("");

              // Always fetch next segment (or update) when user talks to DJ
              // to keep the broadcast responsive to chat.
              // If it's a request, we force an immediate skip.
              if (isRequest(text)) {
                prefetchedDataRef.current = null;
                fetchNextSegment();
              } else {
                // If it's just chatting, we pre-fetch the next segment early 
                // so the DJ can respond in the next song intro or mid-song.
                prefetchNextSegment();
                
                // Optional: We could also trigger a special "commentary" fetch here
                // if we want the DJ to respond immediately without skipping.
              }
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
