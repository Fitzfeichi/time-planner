import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const MAIN_WINDOW_LABEL = 'main';
const MINI_WINDOW_LABEL = 'mini';

export interface DesktopBridge {
  openMiniWindow: () => Promise<void>;
  openMainWindow: () => Promise<void>;
  setMiniAlwaysOnTop: (shouldAlwaysOnTop: boolean) => Promise<boolean>;
  minimizeMiniWindow: () => Promise<void>;
  closeMiniWindow: () => Promise<void>;
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

async function focusWindow(targetWindow: Window | WebviewWindow) {
  await targetWindow.unminimize().catch(() => undefined);
  await targetWindow.show();
  await targetWindow.setFocus();
}

const tauriDesktopBridge: DesktopBridge = {
  async openMiniWindow() {
    const existingMiniWindow = await WebviewWindow.getByLabel(MINI_WINDOW_LABEL);

    if (existingMiniWindow) {
      await focusWindow(existingMiniWindow);
      return;
    }

    const miniWindow = new WebviewWindow(MINI_WINDOW_LABEL, {
      url: '/?view=mini',
      title: '当前任务',
      width: 260,
      height: 230,
      minWidth: 260,
      minHeight: 220,
      maxHeight: 360,
      decorations: false,
      resizable: true,
      backgroundColor: '#f5f5f7',
    });

    miniWindow.once('tauri://created', () => {
      void focusWindow(miniWindow);
    });
  },

  async openMainWindow() {
    const existingMainWindow = await Window.getByLabel(MAIN_WINDOW_LABEL);

    if (existingMainWindow) {
      await focusWindow(existingMainWindow);
      return;
    }

    const mainWindow = new WebviewWindow(MAIN_WINDOW_LABEL, {
      url: '/',
      title: '半小时日计划',
      width: 1180,
      height: 760,
      minWidth: 960,
      minHeight: 620,
      backgroundColor: '#eef2f6',
    });

    mainWindow.once('tauri://created', () => {
      void focusWindow(mainWindow);
    });
  },

  async setMiniAlwaysOnTop(shouldAlwaysOnTop) {
    await getCurrentWindow().setAlwaysOnTop(shouldAlwaysOnTop);
    return shouldAlwaysOnTop;
  },

  async minimizeMiniWindow() {
    await getCurrentWindow().minimize();
  },

  async closeMiniWindow() {
    await getCurrentWindow().close();
  },
};

export function getDesktopBridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (window.desktopBridge) {
    return window.desktopBridge;
  }

  if (isTauriRuntime()) {
    return tauriDesktopBridge;
  }

  return undefined;
}
