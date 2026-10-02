const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all remaining corrupted sequences globally
content = content.replace(/Ã¢â€ Â /g, '-');
content = content.replace(/Ã¢Â Å’/g, '❌');
content = content.replace(/Ã¢â‚¬â€ /g, '-');
content = content.replace(/Ã¢/g, '-'); // Catch-all for any remaining ones

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ALL remaining corrupted text in Invoice.jsx');
