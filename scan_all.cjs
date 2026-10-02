const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.js') || f.endsWith('.jsx')) {
        callback(path.join(dir, f));
      }
    }
  });
}

const corruptedFiles = [];
const rootDir = path.join('d:', 'restaurant', 'Restaurant-billing');

const dirsToCheck = [
  path.join(rootDir, 'Frontend', 'src'),
  path.join(rootDir, 'Backend')
];

dirsToCheck.forEach(dir => {
  walkDir(dir, (filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('Ã¢')) {
        corruptedFiles.push(filePath);
      }
    } catch (e) {
      // ignore read errors
    }
  });
});

console.log('--- Corrupted Files Found ---');
if (corruptedFiles.length === 0) {
  console.log('None! Codebase is completely clean.');
} else {
  corruptedFiles.forEach(f => console.log(f));
}
