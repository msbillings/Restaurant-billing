const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Ã°Å¸Â Â ')) lines[i] = lines[i].replace(/Ã°Å¸Â Â /g, '🏠');
  if (lines[i].includes('Ã°Å¸â€ºÂ Ã¯Â¸Â ')) lines[i] = lines[i].replace(/Ã°Å¸â€ºÂ Ã¯Â¸Â /g, '🛍️');
  if (lines[i].includes('Ã°Å¸Â Â¨')) lines[i] = lines[i].replace(/Ã°Å¸Â Â¨/g, '🍽️');
  if (lines[i].includes('Ã°Å¸â€œÂ ')) lines[i] = lines[i].replace(/Ã°Å¸â€œÂ /g, '📍');
  if (lines[i].includes('Ãƒâ€”')) lines[i] = lines[i].replace(/Ãƒâ€”/g, '×');
  if (lines[i].includes('ðŸ‘‹')) lines[i] = lines[i].replace(/ðŸ‘‹/g, '👋');
  if (lines[i].includes('ðŸ›’')) lines[i] = lines[i].replace(/ðŸ›’/g, '🛒');
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Final emoji map applied to Invoice.jsx');
