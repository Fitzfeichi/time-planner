import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
  Window,
} from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const MAIN_WINDOW_LABEL = 'main';
const MINI_WINDOW_LABEL = 'mini';
const STICKY_NOTE_WINDOW_LABEL = 'sticky-note';
const MINI_WINDOW_WIDTH = 260;
const MINI_WINDOW_INITIAL_HEIGHT = 230;
const MINI_WINDOW_MIN_HEIGHT = 220;
const MINI_WINDOW_MAX_HEIGHT = 640;
const STICKY_NOTE_WINDOW_GAP = 0;
const STICKY_NOTE_WINDOW_MARGIN = 8;
const STICKY_NOTE_VISIBLE_HEIGHT_ADJUSTMENT = 2;

type StickyNoteDockSide = 'left' | 'right';

interface StickyNotePlacement {
  position: LogicalPosition;
  width: number;
  height: number;
  side: StickyNoteDockSide;
}

let cleanupStickyNoteWindowSync: (() => void) | null = null;

export interface DesktopBridge {
  openMiniWindow: () => Promise<void>;
  openMainWindow: () => Promise<void>;
  setMiniAlwaysOnTop: (shouldAlwaysOnTop: boolean) => Promise<boolean>;
  resizeMiniWindow: (height: number) => Promise<void>;
  minimizeMiniWindow: () => Promise<void>;
  closeMiniWindow: () => Promise<void>;
  toggleStickyNoteWindow?: (shouldAlwaysOnTop: boolean) => Promise<boolean>;
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

async function focusWindow(targetWindow: Window | WebviewWindow) {
  await targetWindow.unminimize().catch(() => undefined);
  await targetWindow.show();
  await targetWindow.setFocus();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

async function getStickyNotePlacement(
  miniWindow: Window | WebviewWindow,
  preferredSide?: StickyNoteDockSide,
): Promise<StickyNotePlacement> {
  const [miniInnerPosition, miniInnerSize, monitor, scaleFactor] = await Promise.all([
    miniWindow.innerPosition(),
    miniWindow.innerSize(),
    currentMonitor(),
    miniWindow.scaleFactor(),
  ]);
  const miniLogicalPosition = miniInnerPosition.toLogical(scaleFactor);
  const miniLogicalSize = miniInnerSize.toLogical(scaleFactor);
  const workAreaPosition = monitor?.workArea.position.toLogical(scaleFactor);
  const workAreaSize = monitor?.workArea.size.toLogical(scaleFactor);
  const workAreaLeft = workAreaPosition?.x ?? 0;
  const workAreaTop = workAreaPosition?.y ?? 0;
  const workAreaRight = workAreaLeft + (workAreaSize?.width ?? Number.POSITIVE_INFINITY);
  const workAreaBottom = workAreaTop + (workAreaSize?.height ?? Number.POSITIVE_INFINITY);
  const nextWidth = MINI_WINDOW_WIDTH;
  const rightSideX = miniLogicalPosition.x + miniLogicalSize.width + STICKY_NOTE_WINDOW_GAP;
  const leftSideX = miniLogicalPosition.x - nextWidth - STICKY_NOTE_WINDOW_GAP;
  const fitsOnRight = rightSideX + nextWidth <= workAreaRight - STICKY_NOTE_WINDOW_MARGIN;
  const fitsOnLeft = leftSideX >= workAreaLeft + STICKY_NOTE_WINDOW_MARGIN;
  let side = preferredSide ?? (fitsOnRight || !fitsOnLeft ? 'right' : 'left');

  if (side === 'right' && !fitsOnRight && fitsOnLeft) {
    side = 'left';
  } else if (side === 'left' && !fitsOnLeft && fitsOnRight) {
    side = 'right';
  }

  const preferredX = side === 'right' ? rightSideX : leftSideX;
  const minX = workAreaLeft + STICKY_NOTE_WINDOW_MARGIN;
  const maxX = workAreaRight - nextWidth - STICKY_NOTE_WINDOW_MARGIN;
  const minY = workAreaTop + STICKY_NOTE_WINDOW_MARGIN;
  const maxY = workAreaBottom - miniLogicalSize.height - STICKY_NOTE_WINDOW_MARGIN;
  const nextX = clampNumber(preferredX, minX, maxX);
  const nextY = clampNumber(miniLogicalPosition.y, minY, maxY);

  return {
    position: new LogicalPosition(nextX, nextY),
    width: nextWidth,
    height: miniLogicalSize.height - STICKY_NOTE_VISIBLE_HEIGHT_ADJUSTMENT,
    side,
  };
}

function stopStickyNoteWindowSync() {
  cleanupStickyNoteWindowSync?.();
  cleanupStickyNoteWindowSync = null;
}

async function syncStickyNoteWindowWithMini(
  miniWindow: Window | WebviewWindow,
  stickyNoteWindow: WebviewWindow,
  dockSide: StickyNoteDockSide,
) {
  const stickyNotePlacement = await getStickyNotePlacement(miniWindow, dockSide);

  await Promise.all([
    stickyNoteWindow.setPosition(stickyNotePlacement.position),
    stickyNoteWindow.setSize(new LogicalSize(stickyNotePlacement.width, stickyNotePlacement.height)),
  ]);

  return stickyNotePlacement.side;
}

async function startStickyNoteWindowSync(
  miniWindow: Window | WebviewWindow,
  stickyNoteWindow: WebviewWindow,
  initialDockSide: StickyNoteDockSide,
) {
  stopStickyNoteWindowSync();

  let dockSide = initialDockSide;
  let isSyncing = false;
  let shouldSyncAgain = false;

  async function syncStickyNoteWindow() {
    if (isSyncing) {
      shouldSyncAgain = true;
      return;
    }

    isSyncing = true;

    try {
      dockSide = await syncStickyNoteWindowWithMini(miniWindow, stickyNoteWindow, dockSide);
    } catch {
      stopStickyNoteWindowSync();
    } finally {
      isSyncing = false;
    }

    if (shouldSyncAgain) {
      shouldSyncAgain = false;
      void syncStickyNoteWindow();
    }
  }

  const [stopMovedSync, stopMiniResizedSync] = await Promise.all([
    miniWindow.onMoved(syncStickyNoteWindow),
    miniWindow.onResized(syncStickyNoteWindow),
  ]);

  cleanupStickyNoteWindowSync = () => {
    stopMovedSync();
    stopMiniResizedSync();
  };

  void syncStickyNoteWindow();
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
    const existingStickyNoteWindow = await WebviewWindow.getByLabel(STICKY_NOTE_WINDOW_LABEL);

    await Promise.all([
      getCurrentWindow().setAlwaysOnTop(shouldAlwaysOnTop),
      existingStickyNoteWindow?.setAlwaysOnTop(shouldAlwaysOnTop) ?? Promise.resolve(),
    ]);

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
    const existingStickyNoteWindow = await WebviewWindow.getByLabel(STICKY_NOTE_WINDOW_LABEL);

    if (existingStickyNoteWindow) {
      stopStickyNoteWindowSync();
      await existingStickyNoteWindow.close().catch(() => undefined);
    }

    await getCurrentWindow().close();
  },

  async toggleStickyNoteWindow(shouldAlwaysOnTop) {
    const existingStickyNoteWindow = await WebviewWindow.getByLabel(STICKY_NOTE_WINDOW_LABEL);

    if (existingStickyNoteWindow) {
      stopStickyNoteWindowSync();
      await existingStickyNoteWindow.close();
      return false;
    }

    const currentWindow = getCurrentWindow();
    const stickyNotePlacement = await getStickyNotePlacement(currentWindow);
    const stickyNoteWindow = new WebviewWindow(STICKY_NOTE_WINDOW_LABEL, {
      url: '/?view=sticky-note',
      title: '便利贴',
      x: stickyNotePlacement.position.x,
      y: stickyNotePlacement.position.y,
      width: MINI_WINDOW_WIDTH,
      height: stickyNotePlacement.height,
      minWidth: MINI_WINDOW_WIDTH,
      maxWidth: MINI_WINDOW_WIDTH,
      minHeight: MINI_WINDOW_MIN_HEIGHT,
      maxHeight: MINI_WINDOW_MAX_HEIGHT,
      decorations: false,
      resizable: true,
      alwaysOnTop: shouldAlwaysOnTop,
      backgroundColor: '#fbfbfd',
      preventOverflow: true,
    });

    stickyNoteWindow.once('tauri://created', () => {
      void startStickyNoteWindowSync(currentWindow, stickyNoteWindow, stickyNotePlacement.side);
      void focusWindow(stickyNoteWindow);
    });

    return true;
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
