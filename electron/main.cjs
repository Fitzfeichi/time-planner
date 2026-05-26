const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const {
  MINI_WINDOW_WIDTH,
  MINI_WINDOW_INITIAL_HEIGHT,
  MINI_WINDOW_MIN_WIDTH,
  MINI_WINDOW_MIN_HEIGHT,
  MINI_WINDOW_MAX_HEIGHT,
} = require('./miniWindowSizing.cjs');

let mainWindow = null;
let miniWindow = null;

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.cjs');
const shouldOpenMiniOnly = process.argv.includes('--mini');

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: '半小时日计划',
    autoHideMenuBar: true,
    backgroundColor: '#eef2f6',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  mainWindow.loadFile(distIndexPath);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('view=mini')) {
      createMiniWindow();
      return { action: 'deny' };
    }

    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }

  miniWindow = new BrowserWindow({
    width: MINI_WINDOW_WIDTH,
    height: MINI_WINDOW_INITIAL_HEIGHT,
    minWidth: MINI_WINDOW_MIN_WIDTH,
    minHeight: MINI_WINDOW_MIN_HEIGHT,
    maxHeight: MINI_WINDOW_MAX_HEIGHT,
    title: '当前任务',
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  miniWindow.loadFile(distIndexPath, {
    query: {
      view: 'mini',
    },
  });

  miniWindow.on('closed', () => {
    miniWindow = null;
  });
}

ipcMain.handle('open-mini-window', () => {
  createMiniWindow();
});

ipcMain.handle('open-main-window', () => {
  createMainWindow();
});

ipcMain.handle('set-mini-always-on-top', (event, shouldAlwaysOnTop) => {
  if (
    !miniWindow ||
    miniWindow.isDestroyed() ||
    BrowserWindow.fromWebContents(event.sender) !== miniWindow
  ) {
    return false;
  }

  miniWindow.setAlwaysOnTop(shouldAlwaysOnTop === true);
  return miniWindow.isAlwaysOnTop();
});

ipcMain.handle('minimize-mini-window', (event) => {
  if (
    !miniWindow ||
    miniWindow.isDestroyed() ||
    BrowserWindow.fromWebContents(event.sender) !== miniWindow
  ) {
    return;
  }

  miniWindow.minimize();
});

ipcMain.handle('close-mini-window', (event) => {
  if (
    !miniWindow ||
    miniWindow.isDestroyed() ||
    BrowserWindow.fromWebContents(event.sender) !== miniWindow
  ) {
    return;
  }

  miniWindow.close();
});

app.whenReady().then(() => {
  if (shouldOpenMiniOnly) {
    createMiniWindow();
  } else {
    createMainWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (shouldOpenMiniOnly) {
        createMiniWindow();
      } else {
        createMainWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
