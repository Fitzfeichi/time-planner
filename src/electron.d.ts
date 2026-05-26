export {};

declare global {
  interface Window {
    desktopBridge?: {
      openMiniWindow: () => Promise<void>;
      openMainWindow: () => Promise<void>;
      setMiniAlwaysOnTop: (shouldAlwaysOnTop: boolean) => Promise<boolean>;
      minimizeMiniWindow: () => Promise<void>;
      closeMiniWindow: () => Promise<void>;
    };
  }
}
