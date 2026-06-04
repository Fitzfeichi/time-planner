import type { DesktopBridge } from './lib/desktopBridge';

function assertDesktopBridgeSupportsMiniPin(bridge: DesktopBridge) {
  const result: Promise<boolean> = bridge.setMiniAlwaysOnTop(true);
  return result;
}

function assertDesktopBridgeSupportsMiniControls(bridge: DesktopBridge) {
  const minimizeResult: Promise<void> = bridge.minimizeMiniWindow();
  const closeResult: Promise<void> = bridge.closeMiniWindow();

  return Promise.all([minimizeResult, closeResult]);
}

function assertDesktopBridgeSupportsMiniResize(bridge: DesktopBridge) {
  const result: Promise<void> = bridge.resizeMiniWindow(320);
  return result;
}

void assertDesktopBridgeSupportsMiniPin;
void assertDesktopBridgeSupportsMiniControls;
void assertDesktopBridgeSupportsMiniResize;
