const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Preparing files for Electron build...');

const frontendDist = path.join(__dirname, '../Frontend/dist');
const backendSrc = path.join(__dirname, '../Backend');

const desktopFrontend = path.join(__dirname, 'frontend');
const desktopBackend = path.join(__dirname, 'backend');

// Helper to copy recursively
function copySync(src, dest, ignore = []) {
  if (ignore.some(i => src.includes(i))) return;
  
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(child => {
      copySync(path.join(src, child), path.join(dest, child), ignore);
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clean old folders
if (fs.existsSync(desktopFrontend)) fs.rmSync(desktopFrontend, { recursive: true, force: true });
if (fs.existsSync(desktopBackend)) fs.rmSync(desktopBackend, { recursive: true, force: true });

// Build Frontend
console.log('Building Frontend...');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execSync(`${npmCmd} run build`, { 
  cwd: path.join(__dirname, '../Frontend'), 
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
});

// Copy Backend (Ignore node_modules, session data, uploads, reports, logs)
console.log('Copying Backend...');
copySync(backendSrc, desktopBackend, ['node_modules', '.git', 'auth_info_baileys', 'reports', 'uploads', 'dist', 'logs']);

// Copy Frontend
console.log('Copying Frontend...');
copySync(frontendDist, desktopFrontend);
// Also copy to backend so the Express server can serve it to mobile phones without asar restrictions
const desktopBackendFrontend = path.join(desktopBackend, 'frontend');
copySync(frontendDist, desktopBackendFrontend);

// Convert all root absolute paths to relative paths in index.html for Electron file:// protocol
console.log('Patching HTML asset paths for Electron file:// protocol...');
[desktopFrontend, desktopBackendFrontend].forEach(dir => {
  const indexHtml = path.join(dir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    let html = fs.readFileSync(indexHtml, 'utf8');
    html = html.replace(/src="\/assets\//g, 'src="./assets/');
    html = html.replace(/href="\/assets\//g, 'href="./assets/');
    html = html.replace(/href="\/icon\.png"/g, 'href="./icon.png"');
    html = html.replace(/href="\/manifest\.webmanifest"/g, 'href="./manifest.webmanifest"');
    html = html.replace(/src="\/registerSW\.js"/g, 'src="./registerSW.js"');
    html = html.replace(/ crossorigin/g, '');
    fs.writeFileSync(indexHtml, html);
  }
});

// Disable PWA service worker in Electron & LAN clients to prevent stale chunk cache issues
const swDisableScript = `// Unregister stale service workers to prevent cache errors on mobile & desktop
if('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}
`;

[desktopFrontend, desktopBackendFrontend].forEach(dir => {
  const swPath = path.join(dir, 'registerSW.js');
  if (fs.existsSync(swPath)) {
    fs.writeFileSync(swPath, swDisableScript);
    console.log(`Disabled service worker in ${dir}`);
  }
});

// Fix for Desktop app: Ensure it connects to localhost instead of the hardcoded IP from Vite build
console.log('Patching API URLs for Desktop (localhost)...');
[desktopFrontend, desktopBackendFrontend].forEach(targetDir => {
  const assetsDir = path.join(targetDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(assetsDir, file);
        try {
          let content = fs.readFileSync(filePath, 'utf8');
          content = content.replace(/https:\/\/restaurant-billing-apk\.vercel\.app\/api/g, 'http://127.0.0.1:5002/api');
          content = content.replace(/http:\/\/192\.168\.\d+\.\d+:5002/g, 'http://127.0.0.1:5002');
          content = content.replace(/http:\/\/localhost:5002/g, 'http://127.0.0.1:5002');
          fs.writeFileSync(filePath, content);
        } catch (err) {
          console.warn(`[Build] Warning patching ${file}:`, err.message);
        }
      }
    });
  }
});

// Copy AI Face Detection Models to Backend public folder for local server serving
console.log('Copying AI models to Backend...');
const modelsSrc = path.join(__dirname, '../Frontend/public/models');
const backendModelsDest = path.join(desktopBackend, 'public/models');
const rootBackendModelsDest = path.join(__dirname, '../Backend/public/models');
if (fs.existsSync(modelsSrc)) {
  copySync(modelsSrc, backendModelsDest);
  copySync(modelsSrc, rootBackendModelsDest);
}

const backendLock = path.join(desktopBackend, 'package-lock.json');
if (fs.existsSync(backendLock)) {
  fs.rmSync(backendLock);
}

// Install Backend dependencies inside the Desktop folder
console.log('Installing Backend dependencies for production...');
execSync(`${npmCmd} install --omit=dev --no-package-lock`, { cwd: desktopBackend, stdio: 'inherit' });

console.log('Files ready for electron-builder!');
