const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  openMiniWindow: () => ipcRenderer.invoke('open-mini-window'),
});
