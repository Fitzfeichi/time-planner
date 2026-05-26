const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  openMiniWindow: () => ipcRenderer.invoke('open-mini-window'),
  openMainWindow: () => ipcRenderer.invoke('open-main-window'),
  setMiniAlwaysOnTop: (shouldAlwaysOnTop) =>
    ipcRenderer.invoke('set-mini-always-on-top', shouldAlwaysOnTop),
  minimizeMiniWindow: () => ipcRenderer.invoke('minimize-mini-window'),
  closeMiniWindow: () => ipcRenderer.invoke('close-mini-window'),
});
