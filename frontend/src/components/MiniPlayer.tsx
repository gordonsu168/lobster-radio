
import { useState, useEffect } from 'react';

// 极简悬浮播放器 - 专为悬浮窗设计
export function MiniPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState({
    title: '有人',
    artist: '麦浚龙',
    album: 'On The Road',
    artwork: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ff6b6b" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="white" font-size="30">🦞</text></svg>',
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(80);

  // 模拟播放进度
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full h-full bg-gradient-to-br from-black/90 via-gray-900/95 to-black/90 backdrop-blur-xl text-white rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      {/* 顶部：专辑封面 + 歌曲信息 */}
      <div className="flex items-center gap-3 p-3 pb-2">
        <img 
          src={currentSong.artwork} 
          alt={currentSong.album}
          className="w-14 h-14 rounded-lg shadow-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{currentSong.title}</h3>
          <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
          <p className="text-xs text-gray-500 truncate">{currentSong.album}</p>
        </div>
      </div>

      {/* 进度条 */}
      <div className="px-3 pb-1">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 播放控制按钮 */}
      <div className="flex items-center justify-center gap-4 py-2 px-3">
        <button 
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="上一首"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <button 
          className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-400 hover:scale-105 transition-transform shadow-lg"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <button 
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="下一首"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      {/* 底部：音量和功能按钮 */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
        {/* 音量 */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input 
            type="range" 
            min="0" max="100" 
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-0.5 bg-white/20 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #ff6b6b ${volume}%, rgba(255,255,255,0.2) ${volume}%)`
            }}
          />
        </div>

        {/* 快速操作 */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="喜欢">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="DJ旁白">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="列表">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
