const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace any weird Ã¢ sequences in comments with a dash
content = content.replace(/\/\/[^\n]*Ã[^\n]*/g, (match) => {
  return match.replace(/Ã[^\s]*/g, '-');
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up remaining weird characters in comments in Invoice.jsx');
