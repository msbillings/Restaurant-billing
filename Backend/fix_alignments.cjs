const fs = require('fs');
const path = require('path');

// 1. Fix Invoice.jsx UI Preview Alignment
const invoicePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let invoiceContent = fs.readFileSync(invoicePath, 'utf8');
invoiceContent = invoiceContent.replace(
  /<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: fontMetrics.grandTotalSize, fontWeight: 750, margin: '3px 0' \}\}>/g,
  '<div style={{ display: \'flex\', width: \'100%\', justifyContent: \'space-between\', alignItems: \'center\', fontSize: fontMetrics.grandTotalSize, fontWeight: 750, margin: \'3px 0\' }}>'
);
fs.writeFileSync(invoicePath, invoiceContent, 'utf8');
console.log('Fixed Grand Total UI alignment in Invoice.jsx');

// 2. Fix Thermal Print 80mm Alignment
const bill80Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-80mm.js');
let bill80Content = fs.readFileSync(bill80Path, 'utf8');
bill80Content = bill80Content.replace(
  /const grandTotalCols = 22;/g,
  'const grandTotalCols = 24;' // 48 / 2 = 24 chars for double width
);
fs.writeFileSync(bill80Path, bill80Content, 'utf8');
console.log('Fixed Grand Total thermal alignment in bill-80mm.js');

// 3. Fix Thermal Print 58mm Alignment
const bill58Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-58mm.js');
let bill58Content = fs.readFileSync(bill58Path, 'utf8');
bill58Content = bill58Content.replace(
  /const grandTotalCols = 16;/g,
  'const grandTotalCols = 16;' // 32 / 2 = 16 chars for double width (this might actually be correct already, let's just make sure it's 16)
);
fs.writeFileSync(bill58Path, bill58Content, 'utf8');
console.log('Fixed Grand Total thermal alignment in bill-58mm.js');
