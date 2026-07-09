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
execSync('npm run build', { cwd: path.join(__dirname, '../Frontend'), stdio: 'inherit' });

// Copy Frontend
console.log('Copying Frontend...');
copySync(frontendDist, desktopFrontend);

// Fix for Desktop app: Ensure it connects to localhost instead of the hardcoded IP from Vite build
console.log('Patching API URLs for Desktop (localhost)...');
const assetsDir = path.join(desktopFrontend, 'assets');
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(assetsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      // Replace network IP with localhost for both ports 5002 and 4000
      content = content.replace(/http:\/\/192\.168\.\d+\.\d+:5002/g, 'http://localhost:5002');
      fs.writeFileSync(filePath, content);
    }
  });
}

// Copy Backend (Ignore node_modules)
console.log('Copying Backend...');
copySync(backendSrc, desktopBackend, ['node_modules', '.git']);

// Install Backend dependencies inside the Desktop folder
console.log('Installing Backend dependencies for production...');
execSync('npm install --omit=dev', { cwd: desktopBackend, stdio: 'inherit' });

console.log('Files ready for electron-builder!');
