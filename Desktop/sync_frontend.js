const fs = require('fs');
const path = require('path');

const frontendDist = path.join(__dirname, '../Frontend/dist');
const desktopFrontend = path.join(__dirname, 'frontend');
const desktopBackendFrontend = path.join(__dirname, 'backend/frontend');

function cleanAndCopy(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });

  const copyRecursive = (s, d) => {
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
      fs.readdirSync(s).forEach(child => {
        copyRecursive(path.join(s, child), path.join(d, child));
      });
    } else {
      fs.copyFileSync(s, d);
    }
  };

  copyRecursive(src, dest);
}

console.log('Copying Frontend/dist to Desktop/frontend...');
cleanAndCopy(frontendDist, desktopFrontend);

if (fs.existsSync(path.join(__dirname, 'backend'))) {
  console.log('Copying Frontend/dist to Desktop/backend/frontend...');
  cleanAndCopy(frontendDist, desktopBackendFrontend);
}

// Convert all root absolute paths to relative paths in index.html for Electron file:// protocol
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

console.log('Frontend successfully synced to Desktop!');
