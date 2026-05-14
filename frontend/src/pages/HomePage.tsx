import { useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { MoodSelector } from "../components/MoodSelector";
import { PlayerCard } from "../components/PlayerCard";
import { StatsStrip } from "../components/StatsStrip";
import { TrackQueue } from "../components/TrackQueue";
import { Waveform } from "../components/Waveform";
import { getPreferences, getRecommendations, submitFeedback, synthesizeNarration, generateNarration, generateChat, getSettings } from "../lib/api";
import type { MoodOption, PreferencesSnapshot, RecommendationPayload, Track, VoiceOption, DJStyle } from "../types";

export function HomePage() {
  const [mood, setMood] = useState<MoodOption>("Working");
  const [payload, setPayload] = useState<RecommendationPayload | null>(null);
  const [preferences, setPreferences] = useState<PreferencesSnapshot | null>(null);
  const [voice, setVoice] = useState<VoiceOption>("alloy");
  const [djEmotion, setDjEmotion] = useState<string>("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNarration, setCurrentNarration] = useState("");
  const [djStyle, setDjStyle] = useState<"classic" | "night" | "vibe" | "trivia">("classic");
  const [djLanguage, setDjLanguage] = useState<"zh-CN" | "zh-HK" | "en-US">("zh-CN");
  const [autoChatEnabled, setAutoChatEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const isSpeakingRef = useRef(false);
  const isNarrationPlayingRef = useRef(false);
  const hasStartedInitialPlayRef = useRef(false);
  // 自动闲聊触发控制
  const chatTriggeredRef = useRef<Set<number>>(new Set()); // 已触发的时间点
  const lastChatTimeRef = useRef<number>(0); // 上次闲聊时间
  const audioRef = useRef<HTMLAudioElement>(null);
  const userInteractedRef = useRef(false);
  // 用 ref 存最新的 payload，避免闭包陷阱
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  // DJ 风格显示名称
  const DJ_STYLE_NAMES = {
    classic: "经典电台风",
    night: "深夜治愈风",
    vibe: "活力蹦迪风",
    trivia: "冷知识科普风"
  };

  // 页面加载后：1) 加载用户设置 2) 预热语音合成 3) 监听用户交互解锁自动播放
  useEffect(() => {
    // 加载用户设置的 DJ 语音和情绪
    getSettings().then(settings => {
      if (settings.defaultVoice) {
        setVoice(settings.defaultVoice as VoiceOption);
        console.log("🎤 使用用户设置的语音:", settings.defaultVoice);
      }
      if (settings.djEmotion) {
        setDjEmotion(settings.djEmotion);
        console.log("🎭 使用用户设置的情绪:", settings.djEmotion);
      }
      if (settings.djLanguage) {
        setDjLanguage(settings.djLanguage as any);
        console.log("🌐 使用用户设置的语言:", settings.djLanguage);
      }
      setSettingsLoaded(true);
    }).catch(() => {
      setSettingsLoaded(true);
    });

    // 预热语音合成（触发 voice 加载）
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      // 语音变化时重新获取
      speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        console.log("🎤 语音已加载，共", voices.length, "个语音");
      };
    }

    const unlockAudio = () => {
      userInteractedRef.current = true;
      setUserInteracted(true);
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };

    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // 当心情或语言改变时，自动刷新推荐（等待设置加载完成后）
  useEffect(() => {
    if (settingsLoaded) {
      refreshRecommendations(mood);
    }
  }, [mood, djLanguage, settingsLoaded]);

  // 首次加载且用户有交互后，自动开始播放
  useEffect(() => {
    if (
      payload?.selectedTrack &&
      userInteracted &&
      !hasStartedInitialPlayRef.current
    ) {
      hasStartedInitialPlayRef.current = true;
      const narration = currentNarration || payload.narration || `欢迎收听龙虾电台，为您播放${payload.selectedTrack.artist}的《${payload.selectedTrack.title}》。`;
      playNarrationThenMusic(narration, payload.selectedTrack);
    }
  }, [payload?.selectedTrack?.id, currentNarration, userInteracted]);

  const currentTrack = payload?.selectedTrack ?? null;

  // 切换歌曲时：重置闲聊触发状态（注意：不要在这里设置 audio.src！
  // playNarrationThenMusic 会负责先播放旁白再播放音乐）
  useEffect(() => {
    if (payload?.selectedTrack) {
      // 重置闲聊触发状态
      chatTriggeredRef.current.clear();
      // 设置当前时间，确保前30秒内（通常是刚放完旁白的时候）不会触发新的闲聊
      lastChatTimeRef.current = Date.now();
    }
  }, [payload?.selectedTrack?.id]);

  // 自动闲聊触发器：监听播放时间
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // 如果正在播放旁白、没有用户交互、没有当前歌曲，跳过
      if (isNarrationPlayingRef.current || !userInteractedRef.current || !currentTrack) {
        return;
      }

      const currentTime = audio.currentTime;
      const duration = audio.duration || 180; // 默认3分钟
      const now = Date.now();

      // 距离上次闲聊至少 45 秒，避免话太多
      if (now - lastChatTimeRef.current < 45000) {
        return;
      }

      // 如果关闭了自动闲聊，直接返回
      if (!autoChatEnabled) return;

      // 定义触发时间点（秒）
      const triggerPoints = [
        30,               // 开头 30 秒左右
        duration * 0.33,  // 1/3处
        duration * 0.66,  // 2/3处
        duration - 20,    // 结束前20秒
      ];

      // 检查是否到达某个触发点（+/-2秒容错）
      for (const point of triggerPoints) {
        const pointKey = Math.round(point);
        if (
          !chatTriggeredRef.current.has(pointKey) &&
          currentTime >= point - 1 &&
          currentTime <= point + 2
        ) {
          // 概率触发：开头50%，中间30%，结尾60%
          let probability = 0.3;
          if (point <= 15) probability = 0.5; // 开头概率高
          if (point >= duration - 20) probability = 0.6; // 结尾概率高

          if (Math.random() < probability) {
            console.log(`🎯 自动触发闲聊 @ ${Math.round(currentTime)}秒，概率: ${probability}`);
            chatTriggeredRef.current.add(pointKey);
            lastChatTimeRef.current = now;
            // 触发 DJ 闲聊
            handleDJChat().catch(e => console.warn("自动闲聊失败:", e));
          } else {
            // 即使不触发，也标记为已检查，避免重复判断
            chatTriggeredRef.current.add(pointKey);
          }
          break;
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [currentTrack, autoChatEnabled]);

  // 切换歌曲时：生成旁白文案
  useEffect(() => {
    const currentPayload = payloadRef.current;
    if (!currentPayload?.selectedTrack?.previewUrl || !audioRef.current) return;

    const track = currentPayload.selectedTrack;
    
    // 从后端 Wiki API 动态生成旁白
    generateNarration(track.id, djStyle, djLanguage)
      .then((result) => {
        setCurrentNarration(result.narration);
      })
      .catch(() => {
        // 降级方案：本地模板
        const fallback = `欢迎收听龙虾电台，为您播放${track.artist}的《${track.title}》。`;
        setCurrentNarration(fallback);
      });
  }, [payload?.selectedTrack?.id, djStyle, djLanguage]);

  // 歌曲播放结束自动播放下一首（先旁白，后音乐）
  const handleTrackEnd = () => {
    // 如果是旁白结束，不要切歌（由 handleNarrationEnded 处理）
    if (isNarrationPlayingRef.current) {
      isNarrationPlayingRef.current = false;
      return;
    }
    
    if (!payload?.tracks || !payload.selectedTrack || !audioRef.current) return;
    
    const currentIndex = payload.tracks.findIndex((t) => t.id === payload.selectedTrack?.id);
    const nextIndex = (currentIndex + 1) % payload.tracks.length;
    const nextTrack = payload.tracks[nextIndex];
    
    if (nextTrack?.previewUrl && userInteractedRef.current) {
      setPayload((prev) => prev ? { ...prev, selectedTrack: nextTrack } : null);
      // 为下一首歌生成旁白，然后播放
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
  };

  // 旁白播放后自动开始播放音乐（先旁白，后音乐）
  const playNarrationThenMusic = async (narrationText: string, track: Track) => {
    console.log("🎙️ 播放旁白 + 音乐:", narrationText);
    
    // 标记用户已交互
    userInteractedRef.current = true;
    setUserInteracted(true);
    hasStartedInitialPlayRef.current = true;

    // 先停止正在播放的音乐
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      // 从后端获取 TTS 音频
      const response = await synthesizeNarration(narrationText, voice, { emotion: djEmotion, language: djLanguage });
      
      if (response.audioBase64 && audioRef.current) {
        // 解码 base64
        const binary = atob(response.audioBase64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        
        // 播放旁白
        isNarrationPlayingRef.current = true;
        audioRef.current.src = url;
        audioRef.current.load();
        setIsPlaying(true);
        
        // 旁白结束后播放音乐
        const handleNarrationEnded = () => {
          console.log("🎶 旁白结束，开始播放音乐");
          isNarrationPlayingRef.current = false;
          if (audioRef.current && track.previewUrl) {
            audioRef.current.src = track.previewUrl;
            audioRef.current.load();
            audioRef.current.play().catch(() => {});
          }
        };
        
        audioRef.current.addEventListener("ended", handleNarrationEnded, { once: true });
        await audioRef.current.play();
        
      } else {
        // Fallback: 直接播放音乐
        console.warn("⚠️ 没有旁白音频，直接播放音乐");
        if (audioRef.current && track.previewUrl) {
          audioRef.current.src = track.previewUrl;
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error("❌ 旁白播放失败，直接播放音乐:", error);
      if (audioRef.current && track.previewUrl) {
        audioRef.current.src = track.previewUrl;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  // 播放暂停控制
  function handlePlayPause() {
    if (!audioRef.current || !payload?.selectedTrack?.previewUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      // 也停止浏览器语音
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn("Play error:", e));
      setIsPlaying(true);
    }
  }

  function handleTrackPlay() {
    if (!currentTrack?.previewUrl) {
      console.log("No preview URL");
      return;
    }
    if (isPlaying) {
      handlePlayPause();
    } else {
      userInteractedRef.current = true;
      setUserInteracted(true);
      hasStartedInitialPlayRef.current = true;
      // 先播放旁白，再播放音乐
      const narration = currentNarration || payload?.narration || `欢迎收听龙虾电台，为您播放${currentTrack.artist}的《${currentTrack.title}》。`;
      playNarrationThenMusic(narration, currentTrack);
    }
  }

  async function handleNarrationPlay() {
    // 播放当前动态生成的旁白（从 Wiki API 生成的 currentNarration）
    const narrationToPlay = currentNarration || payload?.narration;
    if (!narrationToPlay) {
      console.warn("⚠️ 没有旁白文字");
      return;
    }

    console.log("🎙️ 播放旁白:", narrationToPlay);
    
    // 标记用户已交互，解锁音频
    userInteractedRef.current = true;
    setUserInteracted(true);
    hasStartedInitialPlayRef.current = true;

    // 先停止正在播放的音乐
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      // 从后端获取 TTS 音频
      const response = await synthesizeNarration(narrationToPlay, voice, { emotion: djEmotion, language: djLanguage });
      console.log("📡 后端返回:", response.provider, response.fallback);
      
      if (!response.audioBase64) {
        console.error("❌ 没有音频数据");
        return;
      }
      
      // 解码 base64 并播放
      const binary = atob(response.audioBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        await audioRef.current.play();
        console.log("✅ 旁白播放开始");
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("❌ 旁白播放失败:", error);
    }
  }

  // DJ 插句话：播放闲聊（音乐作为背景）
  async function handleDJChat() {
    if (!currentTrack) {
      console.warn("⚠️ 没有当前播放的歌曲");
      return;
    }

    console.log("🎤 DJ 插句话！");
    
    // 标记用户已交互
    userInteractedRef.current = true;
    setUserInteracted(true);
    hasStartedInitialPlayRef.current = true;

    try {
      // 1. 生成闲聊内容
      const chatResult = await generateChat(currentTrack.id, djStyle, "manual");
      console.log("💬 闲聊内容:", chatResult.chat);
      setCurrentNarration(chatResult.chat);
      
      // 2. 生成语音
      const response = await synthesizeNarration(chatResult.chat, voice, { emotion: djEmotion, language: djLanguage });
      
      if (!response.audioBase64 || !audioRef.current) {
        console.error("❌ 没有音频数据");
        return;
      }
      
      // 3. 解码 base64
      const binary = atob(response.audioBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      
      // 4. 播放闲聊 + 背景音乐效果
      isNarrationPlayingRef.current = true;
      
      // 降低音乐音量作为背景
      const originalVolume = audioRef.current.volume;
      audioRef.current.volume = 0.15;
      
      // 播放闲聊
      const chatAudio = new Audio();
      chatAudio.src = url;
      chatAudio.volume = Math.min(1.0, originalVolume * 2.5);
      
      // 闲聊结束后恢复音量
      chatAudio.addEventListener("ended", () => {
        console.log("💬 闲聊结束，恢复音量");
        isNarrationPlayingRef.current = false;
        // 平滑恢复音量
        const fadeIn = setInterval(() => {
          if (audioRef.current && audioRef.current.volume < originalVolume) {
            audioRef.current.volume = Math.min(originalVolume, audioRef.current.volume + 0.05);
          } else {
            clearInterval(fadeIn);
          }
        }, 100);
      }, { once: true });
      
      await chatAudio.play().catch(e => console.warn("闲聊播放失败:", e));
      
    } catch (error) {
      console.error("❌ DJ 插句话失败:", error);
    }
  }

  async function handleFeedback(feedback: "like" | "dislike") {
    if (!currentTrack) {
      return;
    }

    const updated = await submitFeedback(currentTrack.id, feedback, mood);
    setPreferences(updated);
    await refreshRecommendations(mood);
  }

  async function refreshRecommendations(nextMood: MoodOption) {
    setLoading(true);
    setError(null);
    try {
      const result = await getRecommendations(nextMood, djLanguage);
      setPayload(result);
      const latestPreferences = await getPreferences();
      setPreferences(latestPreferences);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load station.");
    } finally {
      setLoading(false);
    }
  }

  const queue = useMemo(() => payload?.tracks ?? [], [payload]);

  return (
    <div className="space-y-8">
      {/* 隐藏的音频播放器 */}
      <audio
        ref={audioRef}
        onEnded={handleTrackEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        crossOrigin="anonymous"
        preload="auto"
      />
      <section className="grid gap-6 rounded-[36px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-pulse/10 p-8 lg:grid-cols-[1.2fr,0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-pulse">AI Personal Radio</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Lobster Radio learns what you need right now and voices it like your own late-night station.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
            Blend mood, routine, timing, and feedback into a continuously improving playlist with DJ-style narration.
          </p>
        </div>
        <div className="flex items-center">
          <Waveform active={isPlaying || loading} />
        </div>
      </section>

      <StatsStrip preferences={preferences} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-mist">Set The Mood</p>
            <h2 className="font-display text-2xl font-semibold text-white">Tune the station</h2>
          </div>
          <button
            onClick={() => refreshRecommendations(mood)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
        <MoodSelector value={mood} onChange={setMood} />
      </section>

      {error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200">{error}</p> : null}

      <PlayerCard
        track={currentTrack}
        narration={currentNarration || "选择一首歌开始你的私人电台之旅"}
        voice={voice}
        djStyle={djStyle}
        isPlaying={isPlaying}
        autoChatEnabled={autoChatEnabled}
        onPlayTrack={() => {
          void handleTrackPlay();
        }}
        onPlayNarration={() => {
          void handleNarrationPlay();
        }}
        onDJChat={() => {
          void handleDJChat();
        }}
        onVoiceChange={setVoice}
        onDjStyleChange={(newStyle) => {
          setDjStyle(newStyle);
          // 切风格时重新从后端生成旁白
          if (payload?.selectedTrack) {
            generateNarration(payload.selectedTrack.id, newStyle, djLanguage)
              .then((result) => {
                setCurrentNarration(result.narration);
              })
              .catch(() => {
                // 降级方案
                const track = payload.selectedTrack;
                setCurrentNarration(`${track.artist}《${track.title}》，龙虾电台为您播放。`);
              });
          }
        }}
        onFeedback={(feedback) => {
          void handleFeedback(feedback);
        }}
        onNextTrack={() => {
          if (!payload?.tracks || !payload.selectedTrack || !audioRef.current) return;
          userInteractedRef.current = true;
          setUserInteracted(true);
          hasStartedInitialPlayRef.current = true;
          const currentIndex = payload.tracks.findIndex((t) => t.id === payload.selectedTrack?.id);
          const nextIndex = (currentIndex + 1) % payload.tracks.length;
          const nextTrack = payload.tracks[nextIndex];
          if (nextTrack?.previewUrl) {
            setPayload((prev) => prev ? { ...prev, selectedTrack: nextTrack } : null);
            // 生成旁白并播放（先旁白后音乐）
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
        onAutoChatToggle={setAutoChatEnabled}
      />

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="flex flex-col gap-6">
          <TrackQueue
            tracks={queue}
            currentTrackId={currentTrack?.id ?? null}
            onSelect={(track: Track) => {
              setPayload((existing) => (existing ? { ...existing, selectedTrack: track } : existing));
              userInteractedRef.current = true;
              setUserInteracted(true);
              hasStartedInitialPlayRef.current = true;
              // 点击队列歌曲时：先生成新歌曲的旁白，再播放
              generateNarration(track.id, djStyle, djLanguage)
                .then((result) => {
                  setCurrentNarration(result.narration);
                  void playNarrationThenMusic(result.narration, track);
                })
                .catch(() => {
                  const fallback = `欢迎收听龙虾电台，为您播放${track.artist}的《${track.title}》。`;
                  setCurrentNarration(fallback);
                  void playNarrationThenMusic(fallback, track);
                });
            }}
          />
          <HistoryPanel history={preferences?.history ?? []} />
        </div>
        <div className="hidden lg:block">
          {/* Placeholder to maintain grid balance */}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-mist">Context Summary</p>
        <p className="mt-3 text-sm leading-7 text-slate-200">
          {loading ? "Rebuilding the station..." : payload?.contextSummary ?? "No listening context yet."}
        </p>
      </section>

      {/* Context Summary */}
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 mb-28">
        <p className="text-xs uppercase tracking-[0.25em] text-mist">Context Summary</p>
        <p className="mt-3 text-sm leading-7 text-slate-200">
          {loading ? "Rebuilding the station..." : payload?.contextSummary ?? "No listening context yet."}
        </p>
      </section>

      {/* Floating chat panel fixed at bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-8 pb-4 px-4 z-50">
        <div className="max-w-5xl mx-auto">
          <ChatPanel
            currentTrack={currentTrack}
            onSkipRequested={() => {
              // Trigger skip logic - replicate what onNextTrack does
              if (!payload?.tracks || !payload.selectedTrack || !audioRef.current) return;
              userInteractedRef.current = true;
              setUserInteracted(true);
              hasStartedInitialPlayRef.current = true;
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
            onRefreshRequested={() => {
              // Refresh recommendations with current mood
              refreshRecommendations(mood);
            }}
          />
        </div>
      </div>
    </div>
  );
}
