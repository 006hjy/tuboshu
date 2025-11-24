import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import windowManager from './windowManager.js'
import trayManager from'./trayManager.js'
import shortcutManager from './shortcut/shortcutManager.js'
import contextManager from "./context/contextManager.js"
import AutoLaunch from "./utility/autoLaunch.js"

// app.disableHardwareAcceleration();
//app.commandLine.appendSwitch('disable-gpu');
//app.commandLine.appendSwitch('disable-webrtc');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('ignore-certificate-errors');

app.commandLine.appendSwitch("disable-features", "WebRtcHideLocalIpsWithMdns");
app.commandLine.appendSwitch("force-webrtc-ip-handling-policy", "disable_non_proxied_udp");
app.commandLine.appendSwitch('lang', 'zh-CN');

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process')

// Set userData path to installation directory for portable version
const portableDataPath = process.env.PORTABLE_EXECUTABLE_DIR 
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'tuboshu-user-data')
  : path.join(path.dirname(app.getPath('exe')), 'tuboshu-user-data');

// Test write permissions and fallback to default if needed
try {
  if (!fs.existsSync(portableDataPath)) {
    fs.mkdirSync(portableDataPath, { recursive: true });
  }
  // Test write access with a temporary file
  const testFile = path.join(portableDataPath, '.write-test');
  fs.writeFileSync(testFile, '');
  fs.unlinkSync(testFile);
  app.setPath('userData', portableDataPath);
} catch (err) {
  console.warn('Cannot write to installation directory, falling back to default userData path:', err.message);
  // If write fails, Electron will use default path (AppData on Windows)
}

app.isQuitting = false;
app.isMac = (process.platform === 'darwin');
app.singleLock = app.requestSingleInstanceLock();

app.whenReady().then(() => {
  if (!app.singleLock) return app.quit();

  windowManager.createWindow();
  trayManager.createTray();
  shortcutManager.initShortcuts();
  contextManager.createContextMenu();
  AutoLaunch.initAutoLaunch();
})


app.on('before-quit', () => {
  app.isQuitting = true;
  const win = windowManager.getWindow();
  if (win && !win.isDestroyed()) {
    win.close();
  }
});
app.on('will-quit', () => {
  shortcutManager.unregisterAll();
  trayManager.destroyTray();
})

app.on('window-all-closed', () => {
  if (app.isMac) app.dock.hide();
  else app.quit();
})

app.on('activate', () => {
  if (!windowManager.getWindow()) {
    windowManager.createWindow();
  }else{
    windowManager.getWindow().show();
  }
})


app.on('second-instance', () => {
  windowManager.getWindow()?.show();
})

app.on('render-process-gone', (event, webContents, details) => {
  if (details.reason === 'crashed') {
    windowManager.getMenuView().webContents.reload();
  }
});

// 添加进程异常处理
process.on('unhandledRejection', (error) => {
  console.error('未处理的Promise拒绝:', error)
})

process.on('uncaughtException', (err) => {
  console.error('主进程崩溃:', err);
});