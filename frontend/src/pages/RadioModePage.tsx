import { useEffect, useRef, useState, useMemo } from "react";
import { ChatPanel, type ChatPanelRef } from "../components/ChatPanel";
import { MusicalNoteIcon, ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/solid";
import {
  getPreferences,
  getRecommendations,
  getSettings,
  generateNarration,
  generateOutro,
  getTrivia,
  synthesizeNarration,
  submitFeedback,
  playSequenceOnXiaomi,
  stopXiaomi,
  type XiaomiSpeakerConfig,
} from "../lib/api";
import { createNarrationAudio, cleanupNarrationAudio } from "../lib/audioUtils";
import type { MoodOption, PreferencesSnapshot, Track, DJStyle } from "../types";

// Constants for audio behavior
const TRIVIA_VOLUME_DUCK = 0.15;
const TRIGGER_MIN_PROGRESS = 0.3;
const TRIGGER_MAX_PROGRESS = 0.6;

export function RadioModePage() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [preferences, setPreferences] = useState<PreferencesSnapshot | null>(null);
  const [voice, setVoice] = useState<string>("alloy");
  const [ttsProvider, setTtsProvider] = useState<string>("edge");
  const [djEmotion, setDjEmotion] = useState<string>("normal");
  const [djStyle, setDjStyle] = useState<DJStyle>("classic");
  const [djLanguage, setDjLanguage] = useState<"zh-CN" | "zh-HK" | "en-US">("zh-CN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNarration, setCurrentNarration] = useState<string>("");
  const [currentOutro, setCurrentOutro] = useState<string>("");
  const [currentTrivia, setCurrentTrivia] = useState<string>("");
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);

  // 小米音响
  const [xiaomiConfig, setXiaomiConfig] = useState<XiaomiSpeakerConfig>({ enabled: false, apiUrl: "", deviceId: "" });
  const [speakerOutput, setSpeakerOutput] = useState<"browser" | "xiaomi">("browser");
  
  const triviaTriggeredRef = useRef(false); // 是否已触发过本次插播
  const audioRef = useRef<HTMLAudioElement>(null);
  const userInteractedRef = useRef(false);
  const isLoadingNextRef = useRef(false);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const activeNarrationsRef = useRef<HTMLAudioElement[]>([]);

  // 串行化次要旁白（trivia / wiki reply），避免与 intro/outro/其它旁白重叠
  type NarrationJob = {
    text: string;
    emotion: string;
    onStart?: () => void;
    onEnd?: () => void;
  };
  const narrationQueueRef = useRef<NarrationJob[]>([]);
  const isNarrationProcessingRef = useRef(false);

  function enqueueNarration(job: NarrationJob): void {
    narrationQueueRef.current.push(job);
    void processNarrationQueue();
  }

  async function processNarrationQueue(): Promise<void> {
    if (isNarrationProcessingRef.current) return;
    isNarrationProcessingRef.current = true;
    try {
      while (narrationQueueRef.current.length > 0) {
        // 等待已有 intro/outro 等旁白播完，避免重叠
        while (activeNarrationsRef.current.length > 0) {
          await new Promise(r => setTimeout(r, 200));
        }
        const job = narrationQueueRef.current.shift();
        if (!job) break;
        await playQueuedNarration(job);
      }
    } finally {
      isNarrationProcessingRef.current = false;
    }
  }

  function playQueuedNarration(job: NarrationJob): Promise<void> {
    return new Promise((resolve) => {
      if (!audioRef.current || !job.text.trim()) {
        resolve();
        return;
      }
      const originalVolume = audioRef.current.volume;
      audioRef.current.volume = TRIVIA_VOLUME_DUCK;
      job.onStart?.();

      const finish = () => {
        if (audioRef.current) {
          audioRef.current.volume = originalVolume;
        }
        job.onEnd?.();
        resolve();
      };

      synthesizeNarration(job.text, voice, { provider: ttsProvider, emotion: job.emotion, language: djLanguage })
        .then(response => {
          if (response.audioBase64 && audioRef.current) {
            const { audio: tempAudio, url } = createNarrationAudio(
              response.audioBase64,
              response.mimeType,
              () => {
                cleanupNarration(tempAudio, url);
                finish();
              },
              () => {
                cleanupNarration(tempAudio, url);
                finish();
              }
            );
            // Use original volume for narration, not the ducked volume
            tempAudio.volume = Math.min(1.0, originalVolume * 2.5);
            addNarration(tempAudio);
            tempAudio.play().catch((error) => {
              console.warn("Queued narration play failed:", error);
            });
          } else {
            finish();
          }
        })
        .catch(() => {
          finish();
        });
    });
  }

  function addNarration(audio: HTMLAudioElement): void {
    activeNarrationsRef.current.push(audio);
  }

  function removeNarration(audio: HTMLAudioElement): void {
    activeNarrationsRef.current = activeNarrationsRef.current.filter(
      instance => instance !== audio
    );
  }

  function forEachNarration(callback: (audio: HTMLAudioElement) => void): void {
    activeNarrationsRef.current.forEach(callback);
  }

  function cleanupNarration(audio: HTMLAudioElement, url: string): void {
    audio.pause();
    removeNarration(audio);
    URL.revokeObjectURL(url);
  }

  // 页面加载后加载用户设置
  useEffect(() => {
    getSettings().then(settings => {
      if (settings.defaultVoice) {
        setVoice(settings.defaultVoice);
      }
      if (settings.defaultTtsProvider) {
        setTtsProvider(settings.defaultTtsProvider);
      }
      if (settings.djEmotion) {
        setDjEmotion(settings.djEmotion);
      }
      if (settings.djLanguage) {
        setDjLanguage(settings.djLanguage as any);
      }
      // 加载小米音响配置
      if (settings.xiaomiSpeaker?.enabled) {
        setXiaomiConfig(settings.xiaomiSpeaker);
        setSpeakerOutput("xiaomi");
      }
    }).catch(() => {});

    // 加载偏好
    getPreferences().then(prefs => {
      setPreferences(prefs);
    }).catch(() => {});

    // 预热语音合成
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.getVoices();
      };
    }

    const unlockAudio = () => {
      userInteractedRef.current = true;
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

  // 初始加载推荐
  useEffect(() => {
    if (queue.length === 0) {
      loadMoreRecommendations("Working");
    }
  }, []);

  // 注意：播放现在完全由 playNextTrack 手动启动，不需要 useEffect 自动触发
  // 这避免了因为多次状态更新导致的重复调用问题

  // 当当前歌曲播放完毕，先播 outro，再加载下一首
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

  // 播放下一首
  const playNextTrack = async () => {
    // 重置 trivia 状态
    triviaTriggeredRef.current = false;
    setCurrentTrivia("");
    setCurrentOutro("");
    setShowLyrics(false);

    // 使用函数式更新确保拿到最新队列并取出第一首
    // 这避免了闭包陷阱问题
    let extractedTrack: Track | null = null;
    let remainingAfterPop: number = 0;

    // 第一次尝试获取下一首歌曲
    setQueue(prev => {
      if (prev.length === 0) {
        extractedTrack = null;
        remainingAfterPop = 0;
        return prev;
      }
      const [first, ...rest] = prev;
      extractedTrack = first;
      remainingAfterPop = rest.length;
      return rest;
    });

    // 如果队列是空，先加载更多推荐再试一次
    if (!extractedTrack) {
      setLoading(true);
      try {
        await loadMoreRecommendations("Working");
        // After loading, try again to get a track from the new queue
        setQueue(prev => {
          if (prev.length === 0) {
            extractedTrack = null;
            remainingAfterPop = 0;
            return prev;
          }
          const [first, ...rest] = prev;
          extractedTrack = first;
          remainingAfterPop = rest.length;
          return rest;
        });
        if (!extractedTrack) {
          setError("No tracks available. Please try again later.");
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
        return;
      } finally {
        setLoading(false);
      }
    }

    // 明确类型断言确保 TypeScript 知道这不是 null
    const nextTrack = extractedTrack as Track;

    // 更新当前曲目的状态
    setCurrentTrack(nextTrack);

    // Mark that we're already starting playback manually so the useEffect doesn't interfere
    // This prevents track info mismatch because the useEffect won't play with old state

    // 如果取出第一首后剩余队列少于3，预加载更多推荐
    // 不等待，让加载在后台完成（只调用一次，避免重复请求）
    if (remainingAfterPop < 3) {
      loadMoreRecommendations("Working").catch(() => {});
    }

    // 生成旁白并播放 - 使用我们已经获取的 nextTrack 引用，保证匹配
    try {
      const narrationResult = await generateNarration(nextTrack.id, djStyle, djLanguage);
      setCurrentNarration(narrationResult.narration);
      await playNarrationThenMusic(narrationResult.narration, nextTrack);
    } catch (err) {
      const fallback = `接下来为您播放${nextTrack.artist}的《${nextTrack.title}》。`;
      setCurrentNarration(fallback);
      await playNarrationThenMusic(fallback, nextTrack);
    }
  };

  // 加载更多推荐
  const loadMoreRecommendations = async (mood: MoodOption) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRecommendations(mood, djLanguage);
      // 将新推荐添加到队列末尾
      setQueue(prev => [...prev, ...result.tracks]);
      const latestPreferences = await getPreferences();
      setPreferences(latestPreferences);
      // 如果没有任何歌曲，取出第一首开始播放（仅在初始加载时
      // 这只在没有 currentTrack 的情况（初始加载
      if (!currentTrack && result.tracks.length > 0) {
        const [first, ...rest] = result.tracks;
        setCurrentTrack(first);
        setQueue(rest);
        setCurrentNarration(result.narration);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  // 播放旁白然后音乐 - 支持浏览器和小米音响双模式
  const playNarrationThenMusic = async (narrationText: string, track: Track): Promise<void> => {
    // Add DJ narration to chat panel
    chatPanelRef.current?.addAssistantMessage(narrationText);

    // ---- 小米音响模式 ----
    if (speakerOutput === "xiaomi" && xiaomiConfig.enabled && xiaomiConfig.deviceId) {
      return new Promise((resolve) => {
        userInteractedRef.current = true;
        setIsPlaying(true);

        synthesizeNarration(narrationText, voice, { provider: ttsProvider, emotion: djEmotion, language: djLanguage })
          .then(async (response) => {
            if (!response.audioBase64 || !track.previewUrl) {
              resolve();
              return;
            }
            // 将相对路径转为绝对 URL（小米音响需要可访问的完整 URL）
            const musicUrl = track.previewUrl.startsWith("http")
              ? track.previewUrl
              : `${window.location.origin}${track.previewUrl}`;

            try {
              await playSequenceOnXiaomi(response.audioBase64, musicUrl, xiaomiConfig.deviceId);
            } catch (err) {
              console.warn("Xiaomi play failed:", err);
            }
            resolve();
          })
          .catch(() => resolve());
      });
    }

    // ---- 浏览器模式（原有逻辑）----
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

      synthesizeNarration(narrationText, voice, { provider: ttsProvider, emotion: djEmotion, language: djLanguage })
        .then(response => {
          if (response.audioBase64) {
            const { audio: narrationAudio, url } = createNarrationAudio(
              response.audioBase64,
              response.mimeType,
              () => {
                cleanupNarration(narrationAudio, url);
                playMusicAfterNarration();
              },
              () => {
                cleanupNarration(narrationAudio, url);
                playMusicAfterNarration();
              }
            );

            if (audioRef.current) {
              narrationAudio.volume = Math.min(1.0, audioRef.current.volume * 2.5);
            }
            addNarration(narrationAudio);
            narrationAudio.play().catch(() => {});
          } else {
            playMusicAfterNarration();
          }
        })
        .catch(() => {
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

  // 播放 outro 闲聊，音乐立即切到下一首，outro 在后台继续播放
  const playOutroThenNext = async (outroText: string): Promise<void> => {
    return new Promise((resolve) => {
      // Add DJ outro to chat panel
      chatPanelRef.current?.addAssistantMessage(outroText);

      // Generate outro audio immediately
      synthesizeNarration(outroText, voice, { provider: ttsProvider, emotion: djEmotion, language: djLanguage })
        .then(response => {
          if (response.audioBase64 && audioRef.current) {
            const { audio: outroAudio, url } = createNarrationAudio(
              response.audioBase64,
              response.mimeType,
              () => {
                cleanupNarration(outroAudio, url);
                resolve();
              },
              () => {
                cleanupNarration(outroAudio, url);
                resolve();
              }
            );

            // Sync volume with main audio and boost slightly
            outroAudio.volume = Math.min(1.0, audioRef.current.volume * 2.5);
            addNarration(outroAudio);
            outroAudio.play().catch(() => {
              // Error already handled in the callback
            });
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

  // 处理进度
  const handleTimeUpdate = () => {
    if (!audioRef.current || !currentTrack) {
      return;
    }

    const duration = audioRef.current.duration;
    const currentTime = audioRef.current.currentTime;

    // Find current lyric index
    if (parsedLyrics.length > 0) {
      let newIndex = -1;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time !== -1 && currentTime >= parsedLyrics[i].time) {
          newIndex = i;
        } else if (parsedLyrics[i].time !== -1 && currentTime < parsedLyrics[i].time) {
          break;
        }
      }
      if (newIndex !== currentLyricIndex) {
        setCurrentLyricIndex(newIndex);
      }
    }

    // Auto-scroll lyrics to centered position
    if (showLyrics && lyricsContainerRef.current && currentLyricIndex !== -1) {
      // Find the active line element. 
      // lyricsContainerRef.current has children: [h3, p, p, ...]
      const activeLine = lyricsContainerRef.current.children[currentLyricIndex + 1] as HTMLElement;
      if (activeLine) {
        const containerHeight = lyricsContainerRef.current.clientHeight;
        const lineOffset = activeLine.offsetTop;
        const lineHeight = activeLine.clientHeight;
        
        lyricsContainerRef.current.scrollTo({
          top: lineOffset - containerHeight / 2 + lineHeight / 2,
          behavior: 'smooth'
        });
      }
    }

    if (triviaTriggeredRef.current) return;

    // 在歌曲 30% - 60% 区间触发（选大约中间位置）
    if (currentTime > duration * TRIGGER_MIN_PROGRESS && currentTime < duration * TRIGGER_MAX_PROGRESS) {
      triviaTriggeredRef.current = true;
      playMidTrackTrivia();
    }
  };

  // 播放 mid-track 冷知识旁白（通过队列串行播放，避免与其它旁白重叠）
  const playMidTrackTrivia = async () => {
    if (!currentTrack || !audioRef.current) return;

    try {
      const { hasTrivia, trivia } = await getTrivia(currentTrack.id);
      if (!hasTrivia || !trivia) return;

      // Add trivia to chat panel
      chatPanelRef.current?.addAssistantMessage(`💡 冷知识：${trivia}`);

      enqueueNarration({
        text: trivia,
        emotion: "whisper",
        onStart: () => setCurrentTrivia(trivia),
        onEnd: () => setCurrentTrivia(""),
      });
    } catch (err) {
      console.warn("Mid-track trivia failed, skipping:", err);
    }
  };

  // 播放 Producer 通过 fetchWikipedia 查到资料后的回复（通过队列串行播放）
  const playWikiReply = (reply: string) => {
    if (!reply.trim()) return;
    enqueueNarration({
      text: reply,
      emotion: djEmotion,
    });
  };

  // 播放暂停
  const handlePlayPause = () => {
    if (speakerOutput === "xiaomi") {
      // 小米模式：简化暂停（停止播放）
      if (isPlaying) {
        stopXiaomi(xiaomiConfig.deviceId).catch(() => {});
        setIsPlaying(false);
      } else {
        // 重新播放当前曲目
        if (currentTrack?.previewUrl) {
          playNarrationThenMusic(currentNarration || "", currentTrack);
        }
      }
      return;
    }

    if (!audioRef.current || !currentTrack?.previewUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }
      forEachNarration(audio => audio.pause());
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn("Play error:", e));
      forEachNarration(audio => audio.play().catch(() => {}));
      setIsPlaying(true);
    }
  };

  // 用户点击跳过按钮 - 发送请求给 AI DJ，由 DJ 决定何时切歌
  const handleSkip = () => {
    // 只发送消息，不立即切歌。AI DJ 会在合适时机调用 onSkipRequested 切歌
    chatPanelRef.current?.sendSkipRequest();
  };

  // AI DJ 请求切歌 - 实际执行切歌操作
  const onSkipRequested = async () => {
    if (isLoadingNextRef.current) return;

    if (speakerOutput === "xiaomi") {
      stopXiaomi(xiaomiConfig.deviceId).catch(() => {});
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }

    isLoadingNextRef.current = true;
    try {
      await playNextTrack();
    } finally {
      isLoadingNextRef.current = false;
    }
  };

  // 处理点赞
  const handleLike = async () => {
    if (!currentTrack) return;
    const updated = await submitFeedback(currentTrack.id, "like", "Working");
    setPreferences(updated);
    // 加载更多推荐会使用新的偏好
    loadMoreRecommendations("Working");
  };

  // 处理不喜欢
  const handleDislike = async () => {
    if (!currentTrack) return;
    const updated = await submitFeedback(currentTrack.id, "dislike", "Working");
    setPreferences(updated);
    // 跳过不喜欢的歌曲并加载更多
    loadMoreRecommendations("Working");
    handleSkip();
  };

  // 刷新推荐
  const handleRefresh = () => {
    loadMoreRecommendations("Working");
  };

  useEffect(() => {
    setCurrentLyricIndex(-1);
    setShowLyrics(false);
  }, [currentTrack]);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyric) return [];
    
    const lines = currentTrack.lyric.split('\n');
    const result: { time: number; text: string }[] = [];
    const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/;

    lines.forEach(line => {
      const match = timeRegex.exec(line);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseFloat(match[2]);
        const time = minutes * 60 + seconds;
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          result.push({ time, text });
        }
      } else {
        const text = line.trim();
        if (text && !text.startsWith('[')) {
          result.push({ time: -1, text });
        }
      }
    });

    return result.sort((a, b) => a.time - b.time);
  }, [currentTrack]);

  return (
    <div className="min-h-[calc(100vh-160px)] flex flex-col">
      {/* 隐藏的音频播放器 */}
      <audio
        ref={audioRef}
        onEnded={handleTrackEnd}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        crossOrigin="anonymous"
        preload="auto"
      />

      {/* 主要内容区域 - 居中显示当前歌曲 */}
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-4xl">
          {/* 标题 */}
          <div className="text-center mb-8">
            <p className="text-sm uppercase tracking-[0.35em] text-pulse">Infinite AI Radio</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Continuous Radio Mode
            </h1>
            <p className="mt-3 text-slate-300">
              Chat with your AI DJ to shape the music. The queue never ends.
            </p>
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200 text-center">{error}</p>
          ) : null}

          {/* 当前播放歌曲卡片 - 大尺寸居中 */}
          {currentTrack ? (
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-pulse/10 p-6 md:p-8 backdrop-blur-sm relative">
              
              {/* Lyrics Toggle Button */}
              {currentTrack.lyric && (
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className="absolute top-6 right-6 z-20 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-pulse transition-all group"
                  title={showLyrics ? "Show Info" : "Show Lyrics"}
                >
                  {showLyrics ? (
                    <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
                  ) : (
                    <div className="relative">
                      <MusicalNoteIcon className="h-5 w-5" />
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pulse opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pulse"></span>
                      </span>
                    </div>
                  )}
                </button>
              )}

              <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
                <div className="flex-shrink-0">
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.album}
                    className="h-56 w-56 rounded-[28px] object-cover shadow-glow"
                  />
                </div>
                <div className="flex-1 text-center md:text-left min-w-0">
                  <span className="inline-block rounded-full border border-pulse/40 bg-pulse/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-pulse">
                    {currentTrack.source}
                  </span>
                  
                  {!showLyrics ? (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                      <h2 className="mt-4 font-display text-4xl font-bold text-white truncate">{currentTrack.title}</h2>
                      <p className="mt-3 text-xl text-mist truncate">{currentTrack.artist}</p>
                      <p className="mt-1 text-sm text-mist/90 truncate">{currentTrack.album}</p>

                      {/* 情绪标签 */}
                      <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                        {currentTrack.moodTags.slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div 
                      ref={lyricsContainerRef}
                      className="animate-in fade-in slide-in-from-left-4 duration-500 mt-4 max-h-[180px] overflow-y-auto custom-scrollbar pr-2 relative"
                    >
                      <h3 className="text-xs font-bold uppercase tracking-widest text-pulse mb-3 text-center md:text-left sticky top-0 bg-black/10 backdrop-blur-sm z-10 pb-1">Lyrics</h3>
                      {parsedLyrics.length > 0 ? (
                        parsedLyrics.map((line, idx) => (
                          <p 
                            key={idx} 
                            className={`text-sm mb-2 leading-relaxed transition-all duration-300 text-center md:text-left ${
                              idx === currentLyricIndex 
                                ? "text-white font-bold scale-105" 
                                : "text-slate-200/40 italic"
                            }`}
                          >
                            {line.text}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-slate-200/40 italic text-center md:text-left">No lyrics available</p>
                      )}
                    </div>
                  )}

                  {/* 控制按钮 */}
                  <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
                    <button
                      onClick={handlePlayPause}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.02]"
                    >
                      {isPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <button
                      onClick={handleSkip}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                    >
                      ⏭ Skip
                    </button>
                    <button
                      onClick={handleLike}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 px-4 py-3 text-emerald-200 transition hover:bg-emerald-400/10"
                    >
                      👍 Like
                    </button>
                    <button
                      onClick={handleDislike}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 px-4 py-3 text-rose-200 transition hover:bg-rose-400/10"
                    >
                      👎 Dislike
                    </button>
                  </div>

                  {/* 输出设备切换 */}
                  {xiaomiConfig.enabled && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-mist">
                      <span>输出:</span>
                      <button
                        onClick={() => setSpeakerOutput("browser")}
                        className={`rounded-full px-3 py-1 transition ${
                          speakerOutput === "browser"
                            ? "bg-white/20 text-white"
                            : "text-mist hover:text-white"
                        }`}
                      >
                        💻 浏览器
                      </button>
                      <button
                        onClick={() => setSpeakerOutput("xiaomi")}
                        className={`rounded-full px-3 py-1 transition ${
                          speakerOutput === "xiaomi"
                            ? "bg-pulse/20 text-pulse border border-pulse/40"
                            : "text-mist hover:text-white"
                        }`}
                      >
                        🔊 小米音响
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* DJ 旁白 */}
              {currentNarration && (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-mist mb-3 text-center">DJ Intro</p>
                  <p className="text-base leading-relaxed text-slate-200 text-center italic">
                    {currentNarration}
                  </p>
                </div>
              )}

              {/* DJ Outro - 歌曲结束闲聊 */}
              {currentOutro && (
                <div className="mt-4 rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-mist mb-3 text-center">DJ Outro</p>
                  <p className="text-base leading-relaxed text-slate-200 text-center italic">
                    {currentOutro}
                  </p>
                </div>
              )}

              {/* DJ Trivia - 歌曲中间插播 */}
              {currentTrivia && (
                <div className="mt-4 rounded-[28px] border border-yellow-300/30 bg-yellow-500/10 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-mist mb-3 text-center">💡 Trivia</p>
                  <p className="text-base leading-relaxed text-slate-200 text-center italic">
                    {currentTrivia}
                  </p>
                </div>
              )}

              {/* 队列状态 */}
              <div className="mt-4 flex justify-between items-center text-xs text-mist px-2">
                <span>Queue length: {queue.length} tracks coming up</span>
                <button onClick={handleRefresh} className="underline hover:text-white">
                  Refresh recommendations
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-mist text-lg">
                {loading ? "Loading your radio station..." : "Click anywhere to start the infinite radio..."}
              </p>
              {!loading && (
                <button
                  onClick={() => playNextTrack()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-4 font-semibold text-slate-950 transition hover:scale-[1.02]"
                >
                  ▶ Start Radio
                </button>
              )}
            </div>
          )}

          {/* 加载状态 */}
          {loading && !currentTrack && (
            <div className="mt-6 text-center text-mist">
              <p>Your AI DJ is curating the perfect playlist...</p>
            </div>
          )}
        </div>
      </div>

      {/* 聊天框固定在底部 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-8 pb-4 px-4 z-50">
        <div className="max-w-4xl mx-auto">
          <ChatPanel
            ref={chatPanelRef}
            currentTrack={currentTrack}
            onSkipRequested={onSkipRequested}
            onRefreshRequested={handleRefresh}
            onWikiReply={playWikiReply}
            language={djLanguage}
          />
        </div>
      </div>
    </div>
  );
}
