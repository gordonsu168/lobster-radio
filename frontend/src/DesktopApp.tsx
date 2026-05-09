
import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecommendations, synthesizeNarration, generateChat, generateNarration } from './lib/api';
import type { MoodOption } from './types';

// 自定义标题栏 - 可拖动
function TitleBar({ isMiniMode, onToggleMiniMode }: { isMiniMode: boolean; onToggleMiniMode: () => void }) {
  const handleMinimize = () => {
    if (window.electron) {
      window.electron.minimize();
    }
  };

  const handleClose = () => {
    if (window.electron) {
      window.electron.close();
    }
  };

  return (
    <div 
      className="h-8 flex items-center justify-between px-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 cursor-move select-none backdrop-blur-sm border-b border-white/5"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🦞</span>
        {!isMiniMode && <span className="text-sm font-medium text-white/80">龙虾电台</span>}
      </div>
      
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* 迷你模式切换按钮 */}
        <button 
          onClick={() => {
            // 通知 Electron 改变窗口大小
            if (window.electron?.setMiniMode) {
              window.electron.setMiniMode(!isMiniMode);
            }
            onToggleMiniMode();
          }}
          className="w-4 h-4 rounded-full bg-green-500/80 hover:bg-green-400 transition-colors flex items-center justify-center"
          title={isMiniMode ? '展开' : '迷你模式'}
        >
          <span className="text-[8px] text-white">{isMiniMode ? '□' : '−'}</span>
        </button>
        <button 
          onClick={handleMinimize}
          className="w-4 h-4 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors"
          title="最小化"
        />
        <button 
          onClick={handleClose}
          className="w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors"
          title="关闭"
        />
      </div>
    </div>
  );
}

// 播放器主界面
export default function DesktopApp() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMiniMode, setIsMiniMode] = useState(false); // 🎉 迷你模式开关
  // 🎵 播放模式: sequence(顺序) | loop(单曲循环) | shuffle(随机)
  const [playMode, setPlayMode] = useState<'sequence' | 'loop' | 'shuffle'>('sequence');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const userInteractedRef = useRef(false);

  // 先播放旁白，再播放音乐
  const playNarrationThenMusic = useCallback(async (track: any) => {
    const audio = audioRef.current;
    if (!audio || !track?.previewUrl) return;
    
    userInteractedRef.current = true;
    setCurrentTrack(track);
    
    // 先停止正在播放的音乐
    audio.pause();
    
    try {
      // 生成旁白文案
      let narrationText = track.narration;
      if (!narrationText) {
        try {
          const result = await generateNarration(track.id, 'classic');
          narrationText = result.narration;
        } catch {
          narrationText = `欢迎收听龙虾电台，为您播放${track.artist}的《${track.title}》。`;
        }
      }
      
      // 生成语音
      const audioResult = await synthesizeNarration(narrationText, 'alloy');
      
      if (audioResult.audioBase64) {
        console.log('🎙️ 播放旁白:', narrationText);
        
        // 解码 base64
        const binary = atob(audioResult.audioBase64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: audioResult.mimeType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        // 播放旁白
        setIsNarrationPlaying(true);
        audio.src = url;
        audio.load();
        setIsPlaying(true);
        
        // 旁白结束后播放音乐
        const handleNarrationEnded = () => {
          console.log('🎶 旁白结束，开始播放音乐:', track.title);
          setIsNarrationPlaying(false);
          if (track.previewUrl) {
            audio.src = track.previewUrl;
            audio.load();
            audio.play().catch(e => console.warn('音乐播放失败:', e));
          }
          URL.revokeObjectURL(url);
        };
        
        audio.addEventListener('ended', handleNarrationEnded, { once: true });
        await audio.play().catch(e => console.warn('旁白播放失败:', e));
        
      } else {
        // Fallback: 直接播放音乐
        console.warn('⚠️ 没有旁白音频，直接播放音乐');
        audio.src = track.previewUrl;
        audio.load();
        audio.play().catch(e => console.warn('播放失败:', e));
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('❌ 旁白播放失败，直接播放音乐:', error);
      audio.src = track.previewUrl;
      audio.load();
      audio.play().catch(e => console.warn('播放失败:', e));
      setIsPlaying(true);
    }
  }, []);

  // 播放指定曲目（先播放旁白，再播放音乐）
  const playTrack = useCallback((track: any) => {
    playNarrationThenMusic(track);
  }, [playNarrationThenMusic]);

  // 下一首
  const handleNext = useCallback(() => {
    if (tracks.length === 0) {
      console.warn('⚠️ 没有可播放的歌曲');
      return;
    }
    
    let nextIdx;
    switch (playMode) {
      case 'loop':
        // 单曲循环：重播当前
        nextIdx = currentIndex;
        console.log('🔁 单曲循环，重播当前');
        break;
      case 'shuffle':
        // 随机播放：随机选一个（不是当前）
        do {
          nextIdx = Math.floor(Math.random() * tracks.length);
        } while (nextIdx === currentIndex && tracks.length > 1);
        console.log('🔀 随机播放，选中索引:', nextIdx);
        break;
      case 'sequence':
      default:
        // 顺序播放
        nextIdx = (currentIndex + 1) % tracks.length;
        console.log('➡️ 顺序播放，下一首索引:', nextIdx);
        break;
    }
    
    const nextTrack = tracks[nextIdx];
    console.log('🎵 准备播放:', nextTrack?.title);
    setCurrentIndex(nextIdx);
    playTrack(nextTrack);
  }, [currentIndex, tracks, playMode, playTrack]);

  // 上一首
  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    
    let prevIdx;
    switch (playMode) {
      case 'loop':
        // 单曲循环：重播当前
        prevIdx = currentIndex;
        break;
      case 'shuffle':
        // 随机播放：随机选一个
        do {
          prevIdx = Math.floor(Math.random() * tracks.length);
        } while (prevIdx === currentIndex && tracks.length > 1);
        break;
      case 'sequence':
      default:
        // 顺序播放
        prevIdx = (currentIndex - 1 + tracks.length) % tracks.length;
        break;
    }
    
    setCurrentIndex(prevIdx);
    playTrack(tracks[prevIdx]);
  }, [currentIndex, tracks, playMode, playTrack]);

  // 初始化 - 加载推荐歌曲
  useEffect(() => {
    loadRecommendations();
    
    // 监听来自 Electron 的迷你模式切换
    if (window.electron?.onToggleMiniMode) {
      window.electron.onToggleMiniMode(() => {
        setIsMiniMode(prev => !prev);
      });
    }
  }, []);

  // 注意：不要在这里设置 audio.src！
  // playNarrationThenMusic 会负责先播放旁白再播放音乐

  // 🎯 切换迷你模式时，保持播放状态
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      // 确保切换模式后继续播放
      audioRef.current.play().catch(e => console.log('继续播放失败:', e));
    }
  }, [isMiniMode]);

  // 初始化音频事件
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      // 如果是旁白结束，不要切歌（由 playNarrationThenMusic 内部处理）
      if (audio.src.includes('blob:') && isNarrationPlaying) {
        return;
      }
      // 歌曲播放结束，自动播放下一首
      console.log('🎵 歌曲播放结束，自动播放下一首');
      handleNext();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [isNarrationPlaying, handleNext]);

  // 音量控制
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 加载推荐歌曲
  const loadRecommendations = async () => {
    console.log('🔄 开始加载歌曲...');
    try {
      const result = await getRecommendations('Working' as MoodOption);
      console.log('✅ 加载成功:', result.tracks?.length, '首歌');
      setTracks(result.tracks || []);
      if (result.tracks && result.tracks.length > 0) {
        setCurrentTrack(result.tracks[0]);
        setCurrentIndex(0);
        console.log('🎵 当前歌曲:', result.tracks[0].title, result.tracks[0].previewUrl);
      }
    } catch (e) {
      console.error('❌ 加载歌曲失败:', e);
    } finally {
      setLoading(false);
    }
  };

  // 播放/暂停
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    const track = currentTrack;
    
    if (!audio || !track) {
      console.warn('⚠️ 音频元素或歌曲不存在', { audio: !!audio, track });
      return;
    }
    
    userInteractedRef.current = true;
    
    if (isPlaying) {
      audio.pause();
      console.log('⏸️ 暂停播放');
      setIsPlaying(false);
    } else {
      // 如果还没播放过（audio.src 为空），先播放旁白再播音乐
      if (!audio.src || audio.src === window.location.href) {
        console.log('🎙️ 首次播放，先播放旁白');
        playNarrationThenMusic(track);
      } else {
        // 已经播放过，直接 resume
        try {
          await audio.play();
          console.log('▶️ 恢复播放');
          setIsPlaying(true);
        } catch (e) {
          console.warn('播放失败，重试:', e);
          // 重试：播放旁白+音乐
          playNarrationThenMusic(track);
        }
      }
    }
  }, [isPlaying, currentTrack, playNarrationThenMusic]);

  // DJ 旁白
  const handleDJChat = useCallback(async () => {
    if (!currentTrack) return;
    
    try {
      // 生成闲聊内容
      const chatResult = await generateChat(currentTrack.id, 'classic');
      console.log('🎤 DJ 闲聊:', chatResult.chat);
      
      // 生成语音
      const audioResult = await synthesizeNarration(chatResult.chat, 'alloy');
      
      if (audioResult.audioBase64 && audioRef.current) {
        // 降低音乐音量
        const originalVolume = audioRef.current.volume;
        audioRef.current.volume = 0.15;
        setIsNarrationPlaying(true);
        
        // 播放旁白
        const binary = atob(audioResult.audioBase64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: audioResult.mimeType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const narrationAudio = new Audio(url);
        narrationAudio.volume = 1.0;
        
        narrationAudio.addEventListener('ended', () => {
          // 恢复音量
          if (audioRef.current) {
            audioRef.current.volume = originalVolume;
          }
          setIsNarrationPlaying(false);
          URL.revokeObjectURL(url);
        });
        
        await narrationAudio.play();
      }
    } catch (e) {
      console.warn('DJ 旁白失败:', e);
    }
  }, [currentTrack]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 默认歌曲信息
  const defaultTrack = {
    title: '有人',
    artist: '麦浚龙',
    album: 'On The Road',
    artwork: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23ff6b6b"/><stop offset="100%" style="stop-color:%23ff8e53"/></linearGradient></defs><rect fill="url(%23g)" width="200" height="200" rx="20"/><text x="100" y="115" text-anchor="middle" fill="white" font-size="60">🦞</text></svg>',
  };

  const track = currentTrack || defaultTrack;

  // 🎵 隐藏的音频元素（放在最顶层，不受模式切换影响）
  const AudioElement = (
    <audio 
      ref={audioRef} 
      crossOrigin="anonymous" 
      preload="auto"
    />
  );

  // ============== 🎯 迷你模式播放器 ==============
  if (isMiniMode) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-900/95 via-gray-900/95 to-gray-950/95 text-white overflow-hidden backdrop-blur-xl rounded-2xl">
        {AudioElement}
        <TitleBar isMiniMode={isMiniMode} onToggleMiniMode={() => setIsMiniMode(false)} />
        
        {/* 胶囊播放器主体 */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* 专辑封面 */}
          <div className="relative flex-shrink-0">
            <img 
              src={currentTrack?.artwork || track.artwork}
              alt=""
              className={`w-14 h-14 rounded-xl object-cover shadow-lg transition-transform ${isPlaying ? 'scale-105' : ''}`}
            />
            {isNarrationPlaying && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center text-[10px] animate-pulse">
                🎤
              </div>
            )}
          </div>
          
          {/* 歌曲信息 */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate text-white">{currentTrack?.title || '准备就绪'}</p>
            <p className="text-[11px] text-gray-400 truncate">{currentTrack?.artist || '龙虾电台'}</p>
            {/* 进度条 */}
            <div className="h-1 mt-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {/* 播放控制 */}
          <div className="flex items-center gap-0.5">
            {/* 播放模式按钮 */}
            <button 
              onClick={() => {
                const modes: Array<'sequence' | 'loop' | 'shuffle'> = ['sequence', 'loop', 'shuffle'];
                const currentIdx = modes.indexOf(playMode);
                const nextMode = modes[(currentIdx + 1) % modes.length];
                setPlayMode(nextMode);
              }}
              className={`p-1.5 rounded-full transition-colors ${
                playMode !== 'sequence' ? 'text-green-400' : 'text-gray-400 hover:text-white'
              }`}
              title={{sequence: '顺序播放', loop: '单曲循环', shuffle: '随机播放'}[playMode]}
            >
              {playMode === 'sequence' && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 10h12v2H4v-2zm0 4h8v2H4v-2zm0-8h12v2H4V6z"/>
                </svg>
              )}
              {playMode === 'loop' && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
              )}
              {playMode === 'shuffle' && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
              )}
            </button>
            
            <button 
              onClick={handlePrev}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button 
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-400 hover:scale-105 transition-all shadow-lg"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8 0h4V5h-4v14z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button 
              onClick={handleNext}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950 text-white">
        <div className="text-4xl mb-4 animate-bounce">🦞</div>
        <p className="text-gray-400">龙虾电台启动中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 text-white overflow-hidden">
      {AudioElement}
      
      <TitleBar isMiniMode={isMiniMode} onToggleMiniMode={() => setIsMiniMode(true)} />
      
      <div className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto">
        {/* 专辑封面 */}
        <div className="relative mx-auto">
          <div className={`w-52 h-52 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${isPlaying ? 'scale-105' : ''}`}>
            <img 
              src={track.artwork || defaultTrack.artwork} 
              alt={track.album}
              className="w-full h-full object-cover"
            />
          </div>
          {/* DJ 旁白时显示指示器 */}
          {isNarrationPlaying && (
            <div className="absolute top-2 right-2 px-3 py-1 bg-red-500/80 rounded-full text-xs animate-pulse">
              🎤 DJ 正在说话
            </div>
          )}
        </div>

        {/* 歌曲信息 */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white tracking-wide">{track.title}</h2>
          <p className="text-gray-400 mt-1">{track.artist}</p>
          <p className="text-gray-500 text-sm">{track.album}</p>
        </div>

        {/* 进度条 */}
        <div className="space-y-1">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-300 group-hover:from-red-400 group-hover:to-orange-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 播放控制 */}
        <div className="flex items-center justify-center gap-8 mt-2">
          <button 
            onClick={handlePrev}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="上一首"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-400 hover:scale-105 transition-all shadow-lg hover:shadow-red-500/30"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8 0h4V5h-4v14z"/>
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          
          <button 
            onClick={handleNext}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="下一首"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* 底部功能栏 */}
        <div className="flex items-center justify-between mt-2">
          {/* 音量 */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input 
              type="range" 
              min="0" max="100" 
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* 喜欢 */}
            <button 
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white'}`}
              title="喜欢"
            >
              <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* DJ 旁白 */}
            <button 
              onClick={handleDJChat}
              className={`p-2 rounded-full transition-colors ${isNarrationPlaying ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="DJ 旁白"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </button>

            {/* 播放模式切换 */}
            <button 
              onClick={() => {
                const modes: Array<'sequence' | 'loop' | 'shuffle'> = ['sequence', 'loop', 'shuffle'];
                const currentIdx = modes.indexOf(playMode);
                const nextMode = modes[(currentIdx + 1) % modes.length];
                setPlayMode(nextMode);
                console.log('🎵 播放模式切换:', {sequence: '顺序播放', loop: '单曲循环', shuffle: '随机播放'}[nextMode]);
              }}
              className={`p-2 rounded-full transition-colors ${
                playMode !== 'sequence' ? 'text-green-400 bg-green-400/10' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={{sequence: '顺序播放', loop: '单曲循环', shuffle: '随机播放'}[playMode]}
            >
              {playMode === 'sequence' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 10h12v2H4v-2zm0 4h8v2H4v-2zm0-8h12v2H4V6z"/>
                </svg>
              )}
              {playMode === 'loop' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
              )}
              {playMode === 'shuffle' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
              )}
            </button>

            {/* 刷新列表 */}
            <button 
              onClick={loadRecommendations}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="刷新列表"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 播放队列预览 */}
        <div className="mt-auto pt-4 border-t border-white/5">
          <p className="text-xs text-gray-500 text-center mb-2">
            队列: {currentIndex + 1} / {tracks.length} 首歌
          </p>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {tracks.map((track: any, idx: number) => (
              <div 
                key={track.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  idx === currentIndex ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'
                }`}
                onClick={() => {
                  setCurrentIndex(idx);
                  playTrack(track);
                }}
              >
                <img src={track.artwork} alt="" className="w-8 h-8 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{track.title}</p>
                  <p className="text-[10px] text-gray-500 truncate">{track.artist}</p>
                </div>
                {idx === currentIndex && isPlaying && (
                  <span className="text-xs text-red-400 animate-pulse">▶</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 扩展 Window 类型
declare global {
  interface Window {
    electron: {
      minimize: () => void;
      close: () => void;
      maximize: () => void;
    };
  }
}
