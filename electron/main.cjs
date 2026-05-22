const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow = null;
let miniWindow = null;

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.cjs');
const shouldOpenMiniOnly = process.argv.includes('--mini');

function createMainWindow() {
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
    width: 380,
    height: 520,
    minWidth: 320,
    minHeight: 360,
    title: '当前任务',
    autoHideMenuBar: true,
    backgroundColor: '#fffdf5',
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
