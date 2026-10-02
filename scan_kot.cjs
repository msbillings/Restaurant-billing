const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'KOT.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const badLines = [];
lines.forEach((line, index) => {
  if (line.match(/[^\x00-\x7F]/)) {
    badLines.push(`Line ${index + 1}: ${line.trim()}`);
  }
});

console.log('Non-ASCII lines found:', badLines.length);
if (badLines.length > 0) {
  console.log(badLines.join('\n'));
}
