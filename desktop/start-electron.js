
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;
let tray;

// 禁用硬件加速，防止一些显示问题
app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    x: 20,
    y: 80,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: true,
    vibrancy: 'hud',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // 加载本地开发服务器地址
  const url = 'http://localhost:5173';
  mainWindow.loadURL(url);

  // 打开开发者工具
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    // 如果没有自定义图标，用系统默认的
    const trayIcon = nativeImage.createEmpty();
    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '🦞 龙虾电台', enabled: false },
      { type: 'separator' },
      { label: '显示/隐藏  (⌘+Shift+L)', click: () => toggleWindow() },
      { type: 'separator' },
      { label: '🔊 音量 +10%', click: () => adjustVolume(0.1) },
      { label: '🔉 音量 -10%', click: () => adjustVolume(-0.1) },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);
    
    tray.setTitle('🦞');
    tray.setToolTip('龙虾电台');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      toggleWindow();
    });
  } catch (e) {
    console.log('Tray 创建失败，但不影响使用');
  }
}

function toggleWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

function adjustVolume(delta) {
  // 可以通过控制浏览器音量，这里暂时留空
  console.log('调整音量', delta);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // 注册全局快捷键
  globalShortcut.register('Command+Shift+L', () => {
    toggleWindow();
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
  if (tray) {
    tray.destroy();
  }
});
