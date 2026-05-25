function assertDesktopBridgeSupportsMiniPin(bridge: NonNullable<Window['desktopBridge']>) {
  const result: Promise<boolean> = bridge.setMiniAlwaysOnTop(true);
  return result;
}

void assertDesktopBridgeSupportsMiniPin;
