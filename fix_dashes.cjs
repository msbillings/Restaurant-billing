const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The sequence might be slightly different in memory vs disk.
// We just replace any line that contains at least 3 dashes and some weird unicode back to a clean dashed line.
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('-â€')) {
    lines[i] = "      `----------------------------------------\\n` +";
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed separator dashed lines in Invoice.jsx');
