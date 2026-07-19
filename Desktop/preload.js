const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  silentPrint: (htmlContent, printerName, silent = true) => ipcRenderer.send('silent-print', { htmlContent, printerName, silent }),
  onForceSync: (callback) => ipcRenderer.on('force-sync-cloud', () => callback())
});
