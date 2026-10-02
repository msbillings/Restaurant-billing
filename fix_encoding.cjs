const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  'â‚¹': '₹',
  'â€¢': '•',
  'Ã¢â‚¬â€ ': '—',
  'Ã¢â€ â‚¬': '─',
  'Ã¢Å“â€œ': '✓',
  'Ã¢â€ Â ': '-',
  'Ã¢â€ Âº': '↻',
  'Ã¢Â Å’': '❌',
  'Ã¢Å¡Â¡': '⚡',
  'Ã¢Å“â€¦': '✅'
};

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed remaining encoding issues in Invoice.jsx');
