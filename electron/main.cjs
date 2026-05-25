const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow = null;
let miniWindow = null;

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.cjs');
const shouldOpenMiniOnly = process.argv.includes('--mini');
const MINI_WINDOW_WIDTH = 320;
const MINI_WINDOW_INITIAL_HEIGHT = 230;
const MINI_WINDOW_MIN_WIDTH = 300;
const MINI_WINDOW_MIN_HEIGHT = 190;
const MINI_WINDOW_MAX_HEIGHT = 360;
const MINI_CONTENT_MIN_HEIGHT = 150;
const MINI_CONTENT_MAX_HEIGHT = 320;

function clampMiniContentHeight(height) {
  if (!Number.isFinite(height)) {
    return MINI_CONTENT_MIN_HEIGHT;
  }

  return Math.min(
    MINI_CONTENT_MAX_HEIGHT,
    Math.max(MINI_CONTENT_MIN_HEIGHT, Math.ceil(height)),
  );
}

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

ipcMain.handle('resize-mini-window', (event, requestedContentHeight) => {
  if (
    !miniWindow ||
    miniWindow.isDestroyed() ||
    BrowserWindow.fromWebContents(event.sender) !== miniWindow
  ) {
    return;
  }

  const [contentWidth] = miniWindow.getContentSize();
  miniWindow.setContentSize(contentWidth, clampMiniContentHeight(requestedContentHeight));
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
