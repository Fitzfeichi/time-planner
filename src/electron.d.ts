export {};

declare global {
  interface Window {
    desktopBridge?: {
      openMiniWindow: () => Promise<void>;
    };
  }
}
