const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  openMiniWindow: () => ipcRenderer.invoke('open-mini-window'),
  openMainWindow: () => ipcRenderer.invoke('open-main-window'),
  resizeMiniWindow: (height) => ipcRenderer.invoke('resize-mini-window', height),
  setMiniAlwaysOnTop: (shouldAlwaysOnTop) =>
    ipcRenderer.invoke('set-mini-always-on-top', shouldAlwaysOnTop),
});
