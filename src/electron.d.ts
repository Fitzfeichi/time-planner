export {};

import type { DesktopBridge } from './lib/desktopBridge';

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
    __TAURI_INTERNALS__?: unknown;
  }
}
