import { useEffect, useRef, useState } from "react";
import { SignalIcon, PlayIcon, PauseIcon } from "@heroicons/react/24/solid";
import { getSettings } from "../lib/api";
import { createNarrationAudio, cleanupNarrationAudio } from "../lib/audioUtils";
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
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [voice, setVoice] = useState<string>("alloy");
  const [djStyle, setDjStyle] = useState<DJStyle>("classic");
  const [djLanguage, setDjLanguage] = useState<string>("zh-CN");

  const [messages, setMessages] = useState<{sender: 'user' | 'dj', text: string}[]>([]);
  const [inputText, setInputText] = useState("");
  const [themeContext, setThemeContext] = useState<ThemeContext | null>(null);
  const [playlist, setPlaylist] = useState<Array<{id: string; title: string; artist: string; album?: string; artwork?: string; moodTags?: string[]}>>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const isFetchingRef = useRef(false);

  // Overlay narration
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

    const { audio, url } = createNarrationAudio(
      insert.audioBase64,
      insert.mimeType,
      () => {
        cleanupNarrationAudio(audio, url);
        removeOverlayAudio(audio);
        if (activeOverlayAudiosRef.current.length === 0) {
          restoreMainVolume();
        }
      },
      () => {
        cleanupNarrationAudio(audio, url);
        removeOverlayAudio(audio);
        if (activeOverlayAudiosRef.current.length === 0) {
          restoreMainVolume();
        }
      }
    );

    audio.volume = Math.min(1.0, savedVolumeRef.current * 2.5);
    addOverlayAudio(audio);
    audio.play().catch(console.warn);
  };

  const playDJIntroThenSong = (djBase64: string | null, djMimeType: string, track: Track) => {
    if (!track.previewUrl) {
      // No music to play, fetch next
      fetchNextSegment();
      return;
    }

    pendingTrackRef.current = track;

    const startMusic = () => {
      if (!audioRef.current || !pendingTrackRef.current?.previewUrl) return;
      const t = pendingTrackRef.current;
      console.log("[stream] startMusic playing:", t.title, "by", t.artist, "| previewUrl:", t.previewUrl);
      audioRef.current.src = t.previewUrl!;
      audioRef.current.load();
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      pendingTrackRef.current = null;
    };

    if (!djBase64) {
      startMusic();
      return;
    }

    const { audio: djAudio, url } = createNarrationAudio(
      djBase64,
      djMimeType,
      () => {
        cleanupNarrationAudio(djAudio, url);
        removeOverlayAudio(djAudio);
        startMusic();
      },
      () => {
        cleanupNarrationAudio(djAudio, url);
        removeOverlayAudio(djAudio);
        startMusic();
      }
    );

    djAudio.volume = 1.0;
    addOverlayAudio(djAudio);
    djAudio.play().catch(() => startMusic());
  };

  // --- Core flow ---

  const fetchInitData = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    const res = await fetch('http://localhost:4000/api/stream/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ style: djStyle, language: djLanguage })
    });
    clearTimeout(timeoutId);
    return res.json();
  };

  const applyInitData = (data: any) => {
    console.log("[stream] init: theme =", data.theme_update?.theme);
    console.log("[stream] init: playlist =", data.playlist?.map((t: any) => `${t.title} by ${t.artist}`));

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

    // Apply first segment (theme intro + first track)
    if (data.first_segment) {
      if (data.first_segment.dj_text) {
        setMessages(prev => [...prev, { sender: 'dj', text: data.first_segment.dj_text }]);
      }
      if (data.first_segment.next_track) {
        const track = data.first_segment.next_track;
        console.log("[stream] init: first track =", track.title, "by", track.artist);
        setCurrentTrack(track);
        playDJIntroThenSong(
          data.first_segment.dj_audio_base64,
          data.first_segment.dj_audio_mime_type || 'audio/mp3',
          track
        );
      }
    }
  };

  const fetchSegmentData = async () => {
    const historyContext = messages.slice(-10).map(m => `${m.sender === 'user' ? '听众' : 'DJ小龙'}: ${m.text}`).join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const res = await fetch('http://localhost:4000/api/stream/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        historyContext: historyContext,
        lastTrackId: currentTrack?.id,
        style: djStyle,
        language: djLanguage,
        themeContext: themeContext || undefined
      })
    });
    clearTimeout(timeoutId);
    return res.json();
  };

  const applySegmentData = (data: any) => {
    prefetchTriggeredRef.current = false;

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
      console.log("[stream] setting current track:", data.next_track.title, "by", data.next_track.artist);
      console.log("[stream] DJ narration text:", data.dj_text?.substring(0, 120));
      setCurrentTrack(data.next_track);
      setPlaylist(prev => prev.slice(1));
      playDJIntroThenSong(data.dj_audio_base64, data.dj_audio_mime_type || 'audio/mp3', data.next_track);
    } else {
      setIsPlaying(false);
    }
  };

  const fetchNextSegment = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Reset mid-song state for the new track
    midSongInsertsRef.current = [];
    insertsTriggeredRef.current = new Set();

    try {
      // Use pre-fetched data if available
      let data: any;
      if (prefetchedDataRef.current) {
        console.log("⚡ Using pre-fetched segment data");
        data = prefetchedDataRef.current;
        prefetchedDataRef.current = null;
      } else {
        console.log("📡 Fetching next DJ segment from server...");
        data = await fetchSegmentData();
      }

      applySegmentData(data);
    } catch (e) {
      console.error("Failed to fetch stream segment:", e);
      setIsPlaying(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Pre-fetch next segment in background (called at ~80% song progress)
  const prefetchNextSegment = () => {
    if (prefetchTriggeredRef.current || isFetchingRef.current) return;
    prefetchTriggeredRef.current = true;

    fetchSegmentData().then(data => {
      prefetchedDataRef.current = data;
      console.log("📦 Pre-fetched next segment ready");
    }).catch(e => {
      console.warn("Pre-fetch failed, will fetch normally on track end:", e);
      prefetchTriggeredRef.current = false;
    });
  };

  // --- Audio event handlers ---

  const handleTrackEnded = () => {
    console.log("Music track ended, fetching next segment...");
    if (audioRef.current) {
      audioRef.current.src = '';
    }
    cleanupAllOverlays();
    fetchNextSegment();
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    const duration = audioRef.current.duration;
    if (!duration || !isFinite(duration)) return;

    const progress = audioRef.current.currentTime / duration;

    // Pre-fetch next segment at 80% progress
    if (progress >= 0.8) {
      prefetchNextSegment();
    }

    // Trigger mid-song inserts
    midSongInsertsRef.current.forEach((insert, index) => {
      if (insertsTriggeredRef.current.has(index)) return;

      const targetProgress = TIMING_PROGRESS[insert.timing];
      if (targetProgress === undefined) return;

      if (progress >= targetProgress) {
        insertsTriggeredRef.current.add(index);
        triggerMidSongInsert(insert);
      }
    });
  };

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      if (!currentTrack && !pendingTrackRef.current) {
        // First play: initialize theme + playlist
        if (playlist.length === 0) {
          fetchInitData().then(applyInitData).catch(err => {
            console.error("Init failed, falling back to next:", err);
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
      audioRef.current?.pause();
      activeOverlayAudiosRef.current.forEach(a => a.pause());
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Player Area */}
      <div className="flex-1 shrink-0 flex flex-col gap-6">
        <div className="rounded-[32px] border border-white/10 bg-black/20 p-8 backdrop-blur text-center flex flex-col items-center shadow-2xl">
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
                      <div className={`h-full bg-pulse transition-all duration-1000 ${isPlaying ? 'w-full opacity-30' : 'w-0'}`}></div>
                   </div>
                </div>
              </div>
            ) : (
              <p className="text-mist text-center italic animate-pulse">Waiting for the DJ to take the stage...</p>
            )}
          </div>

          {/* Upcoming Playlist */}
          {playlist.length > 0 && (
            <div className="w-full max-w-md mb-6 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">Up Next</h4>
              <div className="space-y-2">
                {playlist.slice(0, 5).map((track, i) => (
                  <div key={track.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <span className="text-xs font-bold text-white/20 w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-xs text-white/40 truncate">{track.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={togglePlay}
            className="rounded-full bg-white text-black p-8 hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] z-20"
          >
            {isPlaying ? <PauseIcon className="h-12 w-12" /> : <PlayIcon className="h-12 w-12 ml-1" />}
          </button>

          <audio
            ref={audioRef}
            onEnded={handleTrackEnded}
            onTimeUpdate={handleTimeUpdate}
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
