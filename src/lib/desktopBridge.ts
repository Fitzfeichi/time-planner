import { getCurrentWindow, LogicalSize, Window } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const MAIN_WINDOW_LABEL = 'main';
const MINI_WINDOW_LABEL = 'mini';
const MINI_WINDOW_WIDTH = 260;
const MINI_WINDOW_INITIAL_HEIGHT = 230;
const MINI_WINDOW_MIN_HEIGHT = 220;
const MINI_WINDOW_MAX_HEIGHT = 640;

export interface DesktopBridge {
  openMiniWindow: () => Promise<void>;
  openMainWindow: () => Promise<void>;
  setMiniAlwaysOnTop: (shouldAlwaysOnTop: boolean) => Promise<boolean>;
  resizeMiniWindow: (height: number) => Promise<void>;
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
      width: MINI_WINDOW_WIDTH,
      height: MINI_WINDOW_INITIAL_HEIGHT,
      minWidth: MINI_WINDOW_WIDTH,
      minHeight: MINI_WINDOW_MIN_HEIGHT,
      maxHeight: MINI_WINDOW_MAX_HEIGHT,
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

  async resizeMiniWindow(height) {
    const nextHeight = Math.min(
      MINI_WINDOW_MAX_HEIGHT,
      Math.max(MINI_WINDOW_MIN_HEIGHT, Math.ceil(height)),
    );

    await getCurrentWindow().setSize(new LogicalSize(MINI_WINDOW_WIDTH, nextHeight));
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

  if (isTauriRuntime()) {
    return tauriDesktopBridge;
  }

  return undefined;
}
