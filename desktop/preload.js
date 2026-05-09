
// Electron 预加载脚本 - 提供和主进程通信的 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  maximize: () => ipcRenderer.send('window-maximize'),
  setMiniMode: (isMini) => ipcRenderer.send('window-mini-mode', isMini),
  
  // 播放器控制
  play: () => ipcRenderer.send('player-play'),
  pause: () => ipcRenderer.send('player-pause'),
  next: () => ipcRenderer.send('player-next'),
  prev: () => ipcRenderer.send('player-prev'),
  
  // 音量控制
  setVolume: (volume) => ipcRenderer.send('player-volume', volume),
  
  // 事件监听
  onPlayStateChange: (callback) => ipcRenderer.on('play-state-change', callback),
  
  // 监听迷你模式切换（来自全局快捷键）
  onToggleMiniMode: (callback) => ipcRenderer.on('toggle-mini-mode', callback),
});
