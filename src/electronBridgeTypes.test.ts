function assertDesktopBridgeSupportsMiniPin(bridge: NonNullable<Window['desktopBridge']>) {
  const result: Promise<boolean> = bridge.setMiniAlwaysOnTop(true);
  return result;
}

function assertDesktopBridgeSupportsMiniControls(bridge: NonNullable<Window['desktopBridge']>) {
  const minimizeResult: Promise<void> = bridge.minimizeMiniWindow();
  const closeResult: Promise<void> = bridge.closeMiniWindow();

  return Promise.all([minimizeResult, closeResult]);
}

void assertDesktopBridgeSupportsMiniPin;
void assertDesktopBridgeSupportsMiniControls;
