const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  exportVideo: (payload) => ipcRenderer.invoke('export:video', payload),
  onExportProgress: (callback) => ipcRenderer.on('export:progress', (_event, fraction) => callback(fraction)),
})
