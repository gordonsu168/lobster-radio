import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import {
  getPreferences,
  getRecommendations,
  getSettings,
  generateNarration,
  generateOutro,
  getTrivia,
  synthesizeNarration,
  submitFeedback,
  type ChatMessage,
} from "../lib/api";
import type { MoodOption, PreferencesSnapshot, RecommendationPayload, Track, VoiceOption, DJStyle } from "../types";

// Constants for audio behavior
const TRIVIA_VOLUME_DUCK = 0.25;
const TRIGGER_MIN_PROGRESS = 0.3;
const TRIGGER_MAX_PROGRESS = 0.6;

export function RadioModePage() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [preferences, setPreferences] = useState<PreferencesSnapshot | null>(null);
  const [voice, setVoice] = useState<VoiceOption>("alloy");
  const [djEmotion, setDjEmotion] = useState<string>("normal");
  const [djStyle, setDjStyle] = useState<DJStyle>("classic");
  const [djLanguage, setDjLanguage] = useState<"zh-CN" | "zh-HK" | "en-US">("zh-CN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNarration, setCurrentNarration] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentOutro, setCurrentOutro] = useState<string>("");
  const [currentTrivia, setCurrentTrivia] = useState<string>("");
  const triviaTriggeredRef = useRef(false); // 是否已触发过本次插播

  const isNarrationPlayingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const userInteractedRef = useRef(false);
  const isLoadingNextRef = useRef(false);

  // 页面加载后加载用户设置
  useEffect(() => {
    getSettings().then(settings => {
      if (settings.defaultVoice) {
        setVoice(settings.defaultVoice as VoiceOption);
      }
      if (settings.djEmotion) {
        setDjEmotion(settings.djEmotion);
      }
      if (settings.djLanguage) {
        setDjLanguage(settings.djLanguage as any);
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

  // 当 currentTrack 被设置且还没有开始播放时，自动开始播放
  // 使用函数式更新确保拿到最新的状态
  useEffect(() => {
    if (!currentTrack || !currentNarration || isPlaying || isNarrationPlayingRef.current) {
      return;
    }
    playNarrationThenMusic(currentNarration, currentTrack);
  }, [currentTrack, currentNarration, isPlaying]);

  // 当当前歌曲播放完毕，先播 outro，再加载下一首
  const handleTrackEnd = async () => {
    // 如果正在播放旁白（intro/outro），不要触发切歌
    // 这是因为同一个 audio 元素用于播放旁白，旁白结束会触发 onEnded
    if (isNarrationPlayingRef.current || isLoadingNextRef.current) {
      return;
    }

    isLoadingNextRef.current = true;

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

    isLoadingNextRef.current = false;
  };

  // 播放下一首
  const playNextTrack = async () => {
    // 重置 trivia 状态
    triviaTriggeredRef.current = false;
    setCurrentTrivia("");
    setCurrentOutro("");

    // 使用函数式更新确保拿到最新队列并取出第一首
    // 这避免了闭包陷阱问题
    let nextTrack: Track | null = null;
    setQueue(prev => {
      // 如果队列是空，直接返回
      if (prev.length === 0) {
        nextTrack = null;
        return prev;
      }
      // 取出第一首播放，剩余队列保持
      const [first, ...rest] = prev;
      nextTrack = first;
      return rest;
    });

    // 这里必须等一轮状态更新吗？不 - 因为我们已经在同步闭包里拿到了 nextTrack
    // 即使状态还没更新到组件，我们拿到的值是正确的
    if (!nextTrack) {
      setError("No tracks available. Please try again later.");
      return;
    }

    // 更新当前曲目的状态
    setCurrentTrack(nextTrack);

    // 如果取出第一首后剩余队列为空，预加载更多推荐
    // 不等待，让加载在后台完成
    if (queue.length <= 1) {
      await loadMoreRecommendations("Working");
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

    // 如果剩余队列长度少于3，预加载
    if (queue.length < 3) {
      loadMoreRecommendations("Working").catch(() => {});
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

  // 播放旁白然后音乐
  const playNarrationThenMusic = async (narrationText: string, track: Track): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioRef.current) {
        resolve();
        return;
      }

      userInteractedRef.current = true;
      audioRef.current.pause();

      const playMusicAfterNarration = () => {
        isNarrationPlayingRef.current = false;
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
          if (response.audioBase64 && audioRef.current) {
            const binary = atob(response.audioBase64);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            isNarrationPlayingRef.current = true;
            audioRef.current.src = url;
            audioRef.current.load();
            setIsPlaying(true);

            const handleEnded = () => {
              URL.revokeObjectURL(url);
              playMusicAfterNarration();
            };

            const handleError = () => {
              URL.revokeObjectURL(url);
              playMusicAfterNarration();
            };

            audioRef.current.addEventListener("ended", handleEnded, { once: true });
            audioRef.current.play().catch(handleError);
          } else {
            // 没有旁白，直接播放音乐
            if (audioRef.current && track.previewUrl) {
              audioRef.current.src = track.previewUrl;
              audioRef.current.load();
              audioRef.current.play().catch(() => {});
              setIsPlaying(true);
            }
            resolve();
          }
        })
        .catch(() => {
          // 出错直接播放音乐
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

  // 播放 outro 闲聊，然后播放下一首歌的旁白和音乐
  const playOutroThenNext = async (outroText: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioRef.current) {
        resolve();
        return;
      }

      userInteractedRef.current = true;
      audioRef.current.pause();

      const afterOutroEnded = () => {
        isNarrationPlayingRef.current = false;
        playNextTrack();
        resolve();
      };

      synthesizeNarration(outroText, voice, { emotion: djEmotion, language: djLanguage })
        .then(response => {
          if (response.audioBase64 && audioRef.current) {
            const binary = atob(response.audioBase64);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            isNarrationPlayingRef.current = true;
            audioRef.current.src = url;
            audioRef.current.load();
            setIsPlaying(true);

            const handleEnded = () => {
              URL.revokeObjectURL(url);
              afterOutroEnded();
            };

            const handleError = () => {
              URL.revokeObjectURL(url);
              afterOutroEnded();
            };

            audioRef.current.addEventListener("ended", handleEnded, { once: true });
            audioRef.current.play().catch(handleError);
          } else {
            // 没有音频，直接继续
            playNextTrack();
            resolve();
          }
        })
        .catch(() => {
          // 出错直接继续
          playNextTrack();
          resolve();
        });
    });
  };

  // 处理歌曲进度，触发 mid-track trivia 插播
  const handleTimeUpdate = () => {
    if (!audioRef.current || !currentTrack || triviaTriggeredRef.current) {
      return;
    }

    const duration = audioRef.current.duration;
    const currentTime = audioRef.current.currentTime;

    // 在歌曲 30% - 60% 区间触发（选大约中间位置）
    if (currentTime > duration * TRIGGER_MIN_PROGRESS && currentTime < duration * TRIGGER_MAX_PROGRESS) {
      triviaTriggeredRef.current = true;
      playMidTrackTrivia();
    }
  };

  // 播放 mid-track 冷知识旁白（降低主音量 → 播旁白 → 恢复音量）
  const playMidTrackTrivia = async () => {
    if (!currentTrack || !audioRef.current) return;

    try {
      const { hasTrivia, trivia } = await getTrivia(currentTrack.id);
      if (!hasTrivia || !trivia) return;

      setCurrentTrivia(trivia);
      const originalVolume = audioRef.current.volume;

      // 降低主音乐音量
      audioRef.current.volume = TRIVIA_VOLUME_DUCK;

      // 播放 trivia
      return new Promise<void>((resolve) => {
        synthesizeNarration(trivia, voice, { emotion: "whisper", language: djLanguage })
          .then(response => {
            if (response.audioBase64 && audioRef.current) {
              const binary = atob(response.audioBase64);
              const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
              const blob = new Blob([bytes], { type: response.mimeType || "audio/mpeg" });
              const url = URL.createObjectURL(blob);

              const tempAudio = new Audio(url);
              tempAudio.play().catch((error) => {
                console.warn("Trivia audio play failed:", error);
                if (audioRef.current) {
                  audioRef.current.volume = originalVolume;
                }
                setCurrentTrivia("");
                URL.revokeObjectURL(url);
                resolve();
              });
              tempAudio.onended = () => {
                if (audioRef.current) {
                  audioRef.current.volume = originalVolume;
                }
                setCurrentTrivia("");
                URL.revokeObjectURL(url);
                resolve();
              };
              tempAudio.onerror = () => {
                if (audioRef.current) {
                  audioRef.current.volume = originalVolume;
                }
                setCurrentTrivia("");
                URL.revokeObjectURL(url);
                resolve();
              };
            } else {
              if (audioRef.current) {
                audioRef.current.volume = originalVolume;
              }
              setCurrentTrivia("");
              resolve();
            }
          })
          .catch(() => {
            if (audioRef.current) {
              audioRef.current.volume = originalVolume;
            }
            setCurrentTrivia("");
            resolve();
          });
      });
    } catch (err) {
      console.warn("Mid-track trivia failed, skipping:", err);
    }
  };

  // 播放暂停
  const handlePlayPause = () => {
    if (!audioRef.current || !currentTrack?.previewUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn("Play error:", e));
      setIsPlaying(true);
    }
  };

  // 跳过当前歌曲
  const handleSkip = async () => {
    if (isLoadingNextRef.current) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    isLoadingNextRef.current = true;
    await playNextTrack();
    isLoadingNextRef.current = false;
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
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-pulse/10 p-6 md:p-8 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
                <div className="flex-shrink-0">
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.album}
                    className="h-56 w-56 rounded-[28px] object-cover shadow-glow"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <span className="inline-block rounded-full border border-pulse/40 bg-pulse/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-pulse">
                    {currentTrack.source}
                  </span>
                  <h2 className="mt-4 font-display text-4xl font-bold text-white">{currentTrack.title}</h2>
                  <p className="mt-3 text-xl text-mist">{currentTrack.artist}</p>
                  <p className="mt-1 text-sm text-mist/90">{currentTrack.album}</p>

                  {/* 情绪标签 */}
                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                    {currentTrack.moodTags.slice(0, 5).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>

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
            currentTrack={currentTrack}
            onSkipRequested={handleSkip}
            onRefreshRequested={handleRefresh}
          />
        </div>
      </div>
    </div>
  );
}
