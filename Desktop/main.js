const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let backendProcess;

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Cache & Restart',
          click: async () => {
            const { session } = require('electron');
            await session.defaultSession.clearCache();
            app.relaunch();
            app.exit(0);
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        {
          label: 'Force Sync with Cloud',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('force-sync-cloud');
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { 
          role: 'togglefullscreen',
          accelerator: 'F11'
        }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [
              { role: 'close' }
            ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: '📖 User Manual / Guide',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('show-user-manual');
          }
        },
        { type: 'separator' },
        {
          label: '📞 Contact Support',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('show-contact-support');
          }
        },
        { type: 'separator' },
        {
          label: '🔄 Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
            dialog.showMessageBox({
              type: 'info',
              title: 'Check for Updates',
              message: 'Checking for updates in the background. You will be notified if a new version is available.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'ℹ️ About MS Billing',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('show-about', app.getVersion());
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: "RestoPOS",
    show: false // Wait until ready to show
  });

  // Clear cache on launch to prevent stale asset hash imports
  const { session } = require('electron');
  session.defaultSession.clearCache().catch(() => {});
  session.defaultSession.clearCodeCaches({}).catch(() => {});

  // Load the built static files
  mainWindow.loadFile(path.join(__dirname, 'frontend/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const { fork } = require('child_process');
  
  // Check if app is packaged
  const isPackaged = app.isPackaged;

  // Path to backend
  // In development, it's ./backend
  // In production, it's extracted to process.resourcesPath/backend because we use extraResources
  const backendPath = isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, 'backend');

  let serverPath = path.join(backendPath, 'server.js');
  
  // When packaged by electron-builder, files unpacked from ASAR are stored in app.asar.unpacked
  if (serverPath.includes('app.asar')) {
    serverPath = serverPath.replace('app.asar', 'app.asar.unpacked');
    backendPath = backendPath.replace('app.asar', 'app.asar.unpacked');
  }
  
  const fs = require('fs');
  const backendLogPath = path.join(app.getPath('userData'), 'backend.log');
  let logStream = fs.createWriteStream(backendLogPath, { flags: 'a' });

  // Start the backend Node server using Electron's bundled Node process
  backendProcess = fork(serverPath, [], {
    cwd: backendPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      APP_USER_DATA_PATH: app.getPath('userData')
    },
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    logStream.write(data);
    console.log(`[BACKEND]: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    logStream.write(data);
    console.error(`[BACKEND ERR]: ${data}`);
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend server.', err);
    dialog.showErrorBox('Backend Error', `Failed to start the local database server.\nPath: ${serverPath}\nError: ${err.message}\n\nPlease make sure you have an active internet connection for the database.`);
  });

  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`Backend process exited with code ${code}`);
      const tailLogs = fs.readFileSync(backendLogPath, 'utf8').split('\n').slice(-20).join('\n');
      dialog.showErrorBox('Backend Crashed', `The background database server crashed unexpectedly.\nExit Code: ${code}\n\nLast Logs:\n${tailLogs}\n\nPlease contact support with this screenshot.`);
    }
  });
}

ipcMain.handle('get-printers', async () => {
  if (mainWindow && mainWindow.webContents) {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      console.log('[Print] Found OS printers:', printers.map(p => p.name));
      return printers;
    } catch (err) {
      console.error('[Print] Failed to fetch OS printers:', err);
      return [];
    }
  }
  return [];
});

ipcMain.on('silent-print', (event, { htmlContent, printerName, silent = true }) => {
  console.log('[Print] silent-print received, silent:', silent, 'printer:', printerName || '(default)');
  
  let printWindow = new BrowserWindow({ 
    show: !silent, // Must be visible for OS print dialog to work correctly on Windows
    width: 400,
    height: 800
  });
  
  if (!silent) {
    printWindow.setMenuBarVisibility(false);
  }
  // Find all compiled CSS files
  let cssContent = '';
  try {
    const assetsPath = path.join(__dirname, 'frontend/assets');
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      const cssFiles = files.filter(f => f.endsWith('.css'));
      cssContent = cssFiles.map(f => fs.readFileSync(path.join(assetsPath, f), 'utf8')).join('\n');
    }
  } catch (err) {
    console.error('[Print] Could not load CSS for printing:', err);
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>${cssContent}</style>
        <style>
          html, body {
            margin: 0;
            padding: 10px;
            background-color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          .receipt-print {
            margin: 0 auto !important;
            max-width: 280px !important;
          }
          @page { margin: 0; size: 80mm auto portrait; }
          @media print {
            html, body {
              width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            body > * {
              margin: 0 auto !important;
              position: relative !important;
              top: 0 !important;
              left: 0 !important;
              transform: none !important;
            }
            .print\\:hidden { display: none !important; }
            .print\\:p-0 { padding: 0 !important; }
            .print\\:m-0 { margin: 0 !important; }
            .print\\:shadow-none { box-shadow: none !important; }
            .print\\:border-0 { border: 0 !important; }
            .print\\:max-w-none { max-width: none !important; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  // Write HTML to a temp file to avoid data: URL size limits
  const tempPath = path.join(app.getPath('temp'), 'msbilling-print.html');
  try {
    fs.writeFileSync(tempPath, fullHtml, 'utf8');
    printWindow.loadFile(tempPath);
  } catch (err) {
    console.error('[Print] Failed to write temp file, falling back to data URL:', err);
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
  }
  
  printWindow.webContents.once('did-finish-load', () => {
    console.log('[Print] Print window loaded, sending to printer...');
    // Slight delay to ensure CSS is fully painted before sending to printer spooler
    setTimeout(() => {
      const printOptions = {
        silent: silent,
        margins: { marginType: 'none' },
        landscape: false,
        printBackground: true,
        color: false
      };
      if (printerName && typeof printerName === 'string' && printerName.trim()) {
        printOptions.deviceName = printerName.trim();
      }
      console.log('[Print] Print options:', JSON.stringify(printOptions));
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          console.log('[Print] Print failed:', failureReason);
        } else {
          console.log('[Print] Print succeeded');
        }
        if (!printWindow.isDestroyed()) printWindow.close();
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch (e) {}
      });
    }, 500);
  });

  printWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Print] Window failed to load:', errorCode, errorDescription);
    if (!printWindow.isDestroyed()) printWindow.close();
  });
});

ipcMain.on('print-preview', async (event, { htmlContent, printerName, billNumber }) => {
  let pdfRenderWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 1000,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let cssContent = '';
  try {
    const assetsPath = path.join(__dirname, 'frontend/assets');
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      const cssFiles = files.filter(f => f.endsWith('.css'));
      cssContent = cssFiles.map(f => fs.readFileSync(path.join(assetsPath, f), 'utf8')).join('\n');
    }
  } catch (err) {
    console.error('Could not load CSS for print preview:', err);
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${cssContent}</style>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .flex { display: flex !important; }
          .flex-col { display: flex !important; flex-direction: column !important; }
          .flex-1 { flex: 1 1 0% !important; }
          .items-start { align-items: flex-start !important; }
          .items-center { align-items: center !important; }
          .justify-between { justify-content: space-between !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .text-center { text-align: center !important; }
          .w-full { width: 100% !important; }
          .w-8 { width: 32px !important; }
          .w-14 { width: 56px !important; }
          .w-16 { width: 64px !important; }
          .w-24 { width: 96px !important; }

          .receipt-print, #invoice-print-area {
            width: 320px !important;
            max-width: 320px !important;
            min-width: 320px !important;
            margin: 0 auto !important;
            padding: 12px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
          .receipt-print *, #invoice-print-area * {
            box-sizing: border-box !important;
          }
          .receipt-print img, #invoice-print-area img, img {
            max-width: 90px !important;
            max-height: 60px !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin: 0 auto !important;
            display: block !important;
          }
          .print\\:hidden { display: none !important; }
        </style>
      </head>
      <body>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td align="center" valign="top" style="text-align: center; padding-top: 15px;">
              <div style="width: 320px; max-width: 320px; margin: 0 auto; text-align: left; display: inline-block;">
                ${htmlContent}
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  pdfRenderWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

  pdfRenderWindow.webContents.once('did-finish-load', async () => {
    try {
      setTimeout(async () => {
        const pdfBuffer = await pdfRenderWindow.webContents.printToPDF({
          printBackground: true,
          marginsType: 0,
          pageSize: 'A4'
        });
        pdfRenderWindow.close();

        const defaultFileName = billNumber ? `Bill_${billNumber}.pdf` : `Bill_${Date.now()}.pdf`;
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
          title: 'Download Bill PDF',
          defaultPath: path.join(app.getPath('downloads'), defaultFileName),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });

        if (filePath) {
          fs.writeFileSync(filePath, pdfBuffer);
          console.log('[PDF] Bill successfully saved to:', filePath);
        }
      }, 400);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      if (!pdfRenderWindow.isDestroyed()) pdfRenderWindow.close();
    }
  });
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  try {
    autoUpdater.logger = console;
  } catch (e) {}

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info ? info.version : 'new version');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Application is up to date.');
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info ? info.version : 'ready');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-ready');
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of MS Billing has been downloaded. The application will now restart to apply updates.',
        buttons: ['Restart Now']
      }).then(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    }
  });

  ipcMain.on('install-update', () => {
    console.log('[AutoUpdater] User requested install update.');
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.on('check-for-updates', () => {
    console.log('[AutoUpdater] Manual check triggered.');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[AutoUpdater] Check error:', err);
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
  });
}

app.on('ready', async () => {
  startBackend();

  // ✅ Clear ALL caches on startup to prevent stale chunk references
  const { session } = require('electron');
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    });
    await session.defaultSession.clearCodeCaches({});
    console.log('[Cache] Cleared Electron cache, service workers, and code caches on startup');
  } catch (err) {
    console.error('[Cache] Error clearing cache:', err);
  }

  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    console.log(`[Permissions] Auto-granting permission request for '${permission}'`);
    callback(true);
  });

  // Also handle permission checks (for navigator.permissions.query)
  session.defaultSession.setPermissionCheckHandler((_, permission) => {
    return true;
  });

  // Wait a little bit for the backend to initialize
  setTimeout(() => {
    createMenu();
    createWindow();
    setupAutoUpdater();
    
    // Initial check for updates
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[AutoUpdater] Initial check error:', err);
    });

    // Check for updates every 3 minutes (180,000 ms) so new GitHub releases show up immediately
    setInterval(() => {
      console.log('[AutoUpdater] Scheduled update check running...');
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('[AutoUpdater] Periodic check error:', err);
      });
    }, 3 * 60 * 1000);
  }, 2000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Kill the backend process when the app closes
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
