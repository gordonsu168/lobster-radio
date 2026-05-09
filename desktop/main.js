
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

// 窗口配置
const WINDOW_CONFIG = {
  full: { width: 380, height: 620 },
  mini: { width: 340, height: 96 }
};

// 禁用硬件加速
app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.full.width,
    height: WINDOW_CONFIG.full.height,
    minWidth: 320,
    minHeight: 96,
    x: 20,
    y: 100,
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    roundedCorners: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加载桌面版界面
  const url = 'http://localhost:5173/desktop';
  mainWindow.loadURL(url);

  // 打开开发者工具（调试用）
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============== IPC 通信 ==============

// 最小化
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

// 关闭
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// 最大化/还原
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// 🎯 迷你模式切换
ipcMain.on('window-mini-mode', (event, isMini) => {
  if (mainWindow) {
    const config = isMini ? WINDOW_CONFIG.mini : WINDOW_CONFIG.full;
    // 平滑动画调整大小
    mainWindow.setSize(config.width, config.height, true);
  }
});

// 播放器控制
ipcMain.on('player-play', () => {
  if (mainWindow) {
    mainWindow.webContents.send('player-action', 'play');
  }
});

ipcMain.on('player-pause', () => {
  if (mainWindow) {
    mainWindow.webContents.send('player-action', 'pause');
  }
});

ipcMain.on('player-next', () => {
  if (mainWindow) {
    mainWindow.webContents.send('player-action', 'next');
  }
});

ipcMain.on('player-prev', () => {
  if (mainWindow) {
    mainWindow.webContents.send('player-action', 'prev');
  }
});

// ============== 应用启动 ==============

app.whenReady().then(() => {
  createWindow();

  // 全局快捷键：Cmd+Shift+L 显示/隐藏
  globalShortcut.register('Command+Shift+L', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // 全局快捷键：Cmd+Shift+M 切换迷你模式
  globalShortcut.register('Command+Shift+M', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-mini-mode');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
