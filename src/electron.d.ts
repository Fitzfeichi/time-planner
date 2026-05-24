export {};

declare global {
  interface Window {
    desktopBridge?: {
      openMiniWindow: () => Promise<void>;
      openMainWindow: () => Promise<void>;
      resizeMiniWindow: (height: number) => Promise<void>;
    };
  }
}
