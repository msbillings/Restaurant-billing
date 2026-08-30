const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  silentPrint: (htmlContent, printerName, silent = true) => ipcRenderer.send('silent-print', { htmlContent, printerName, silent }),
  printPreview: (htmlContent, printerName) => ipcRenderer.send('print-preview', { htmlContent, printerName }),
  onForceSync: (callback) => ipcRenderer.on('force-sync-cloud', () => callback()),
  onShowContactSupport: (callback) => ipcRenderer.on('show-contact-support', () => callback()),
  onShowUserManual: (callback) => ipcRenderer.on('show-user-manual', () => callback()),
  onShowAbout: (callback) => ipcRenderer.on('show-about', (event, version) => callback(version)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', (event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback()),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  showNotification: (data) => ipcRenderer.send('show-notification', data)
});
