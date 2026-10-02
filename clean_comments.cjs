const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Filter out lines that start with the corrupted comment sequence
const lines = content.split('\n');
const cleanedLines = lines.filter(line => {
  // If the line is purely a corrupted comment line or starts with corrupted comment markers
  const trimmed = line.trim();
  if (trimmed.startsWith('// Ã¢')) {
    return false;
  }
  return true;
});

// Also remove inline corrupted fragments like "Ã¢â‚¬â€ " if any still exist
let finalContent = cleanedLines.join('\n');
finalContent = finalContent.replace(/Ã¢â‚¬â€ /g, '—');
finalContent = finalContent.replace(/Ã¢â€ â‚¬/g, '─');
finalContent = finalContent.replace(/Ã¢Å“â€œ/g, '✓');

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Removed corrupted comment lines from Invoice.jsx');
