const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  'Ã°Å¸Â Â ': '🏠',
  'Ã°Å¸â€ºÂ Ã¯Â¸Â ': '🛍️',
  'Ã°Å¸Â Â¨': '🍽️',
  'Ã°Å¸â€œÂ ': '📍',
  'Ãƒâ€”': '×',
  'ðŸ›µ': '🛵',
  'ðŸ§¾': '🧾',
  'ðŸ“¦': '📦'
};

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed final batch of emoji encoding issues in Invoice.jsx');
