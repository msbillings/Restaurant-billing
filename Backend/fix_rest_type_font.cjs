const fs = require('fs');
const path = require('path');

// 1. Fix Invoice.jsx
const invoicePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let invoiceContent = fs.readFileSync(invoicePath, 'utf8');

invoiceContent = invoiceContent.replace(
  /fontStyle: 'italic'/g,
  `fontWeight: 600`
);

fs.writeFileSync(invoicePath, invoiceContent, 'utf8');
console.log('Fixed Invoice.jsx');

// 2. Fix LiveReceiptPreview.jsx
const livePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'LiveReceiptPreview.jsx');
let liveContent = fs.readFileSync(livePath, 'utf8');

liveContent = liveContent.replace(
  /fontStyle: 'italic'/g,
  `fontWeight: 600`
);

fs.writeFileSync(livePath, liveContent, 'utf8');
console.log('Fixed LiveReceiptPreview.jsx');
