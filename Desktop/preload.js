const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  silentPrint: (htmlContent, printerName, silent = true) => ipcRenderer.send('silent-print', { htmlContent, printerName, silent }),
  printPreview: (htmlContent, printerName) => ipcRenderer.send('print-preview', { htmlContent, printerName }),
  onForceSync: (callback) => ipcRenderer.on('force-sync-cloud', () => callback()),
  onShowContactSupport: (callback) => ipcRenderer.on('show-contact-support', () => callback()),
  onShowUserManual: (callback) => ipcRenderer.on('show-user-manual', () => callback()),
  onShowAbout: (callback) => ipcRenderer.on('show-about', (event, version) => callback(version)),
  onCheckingForUpdate: (callback) => ipcRenderer.on('checking-for-update', () => callback()),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', (event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  showNotification: (data) => ipcRenderer.send('show-notification', data)
});
