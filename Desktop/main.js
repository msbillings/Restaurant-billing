const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
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
      preload: path.join(__dirname, 'preload.js')
    },
    title: "RestoPOS",
    show: false // Wait until ready to show
  });

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
  
  // Start the backend Node server using Electron's bundled Node process
  backendProcess = fork(serverPath, [], {
    cwd: backendPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      APP_USER_DATA_PATH: app.getPath('userData')
    },
    stdio: 'inherit'
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend server.', err);
    dialog.showErrorBox('Backend Error', `Failed to start the local database server.\\nPath: ${serverPath}\\nError: ${err.message}\\n\\nPlease make sure you have an active internet connection for the database.`);
  });
}

ipcMain.handle('get-printers', async (event) => {
  if (mainWindow) {
    return await mainWindow.webContents.getPrintersAsync();
  }
  return [];
});

const fs = require('fs');

ipcMain.on('silent-print', (event, { htmlContent, printerName, silent = true }) => {
  let printWindow = new BrowserWindow({ 
    show: !silent, // Must be visible for OS print dialog to work correctly on Windows
    width: 400,
    height: 800
  });
  
  if (!silent) {
    printWindow.setMenuBarVisibility(false);
  }
  // Find the compiled CSS file
  let cssContent = '';
  try {
    const assetsPath = path.join(__dirname, 'frontend/assets');
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      const cssFile = files.find(f => f.endsWith('.css'));
      if (cssFile) {
        cssContent = fs.readFileSync(path.join(assetsPath, cssFile), 'utf8');
      }
    }
  } catch (err) {
    console.error('Could not load CSS for printing:', err);
  }

  const fullHtml = `
    <html>
      <head>
        <style>${cssContent}</style>
        <style>
          @page { margin: 0; size: 80mm auto; }
          @media print {
            html, body {
              width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            body > * {
              margin: 0 !important;
              position: absolute !important;
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

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
  
  printWindow.webContents.once('did-finish-load', () => {
    // Slight delay to ensure CSS is fully painted before sending to printer spooler
    setTimeout(() => {
      printWindow.webContents.print({
        silent: silent,
        deviceName: printerName,
        margins: { marginType: 'none' },
        printBackground: true,
        color: false
      }, (success, failureReason) => {
        if (!success) console.log('Print failed:', failureReason);
        printWindow.close();
      });
    }, 500);
  });
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    console.log('Update available.');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of MS Billing has been downloaded. The application will now restart to apply the updates.',
      buttons: ['Restart Now']
    }).then(() => {
      autoUpdater.quitAndInstall(false, true);
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto updater error:', err);
  });
}

app.on('ready', () => {
  startBackend();
  // Wait a little bit for the backend to initialize
  setTimeout(() => {
    createMenu();
    createWindow();
    setupAutoUpdater();
    autoUpdater.checkForUpdatesAndNotify();
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
