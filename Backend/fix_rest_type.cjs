const fs = require('fs');
const path = require('path');

// 1. Fix bill-80mm.js
const bill80Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-80mm.js');
let bill80Content = fs.readFileSync(bill80Path, 'utf8');
if (!bill80Content.includes('const restType')) {
  bill80Content = bill80Content.replace(
    /const restName = \(s\.restaurantName \|\| 'MS Billings Restaurant'\)\.trim\(\);/,
    `const restName = (s.restaurantName || 'MS Billings Restaurant').trim();\n  const restType = (s.restaurantType || '').trim();`
  );
  bill80Content = bill80Content.replace(
    /headerText \+= CMD\.BOLD_OFF;/,
    `headerText += CMD.BOLD_OFF;\n  if (restType) {\n    const typeMax = 38;\n    const typeLines = wrapTextLines(restType, typeMax);\n    typeLines.forEach(l => {\n      headerText += l + CMD.LINE_FEED;\n    });\n  }`
  );
  fs.writeFileSync(bill80Path, bill80Content, 'utf8');
  console.log('Fixed bill-80mm.js');
}

// 2. Fix bill-58mm.js
const bill58Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-58mm.js');
let bill58Content = fs.readFileSync(bill58Path, 'utf8');
if (!bill58Content.includes('const restType')) {
  bill58Content = bill58Content.replace(
    /const restName = \(s\.restaurantName \|\| 'MS Billings Restaurant'\)\.trim\(\);/,
    `const restName = (s.restaurantName || 'MS Billings Restaurant').trim();\n  const restType = (s.restaurantType || '').trim();`
  );
  bill58Content = bill58Content.replace(
    /headerText \+= CMD\.BOLD_OFF;/,
    `headerText += CMD.BOLD_OFF;\n  if (restType) {\n    const typeMax = 26;\n    const typeLines = wrapTextLines(restType, typeMax);\n    typeLines.forEach(l => {\n      headerText += l + CMD.LINE_FEED;\n    });\n  }`
  );
  fs.writeFileSync(bill58Path, bill58Content, 'utf8');
  console.log('Fixed bill-58mm.js');
}

// 3. Fix Invoice.jsx
const invoicePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Frontend', 'src', 'components', 'Invoice.jsx');
let invoiceContent = fs.readFileSync(invoicePath, 'utf8');

// 58mm
if (!invoiceContent.includes('{activeSettings.restaurantType && (')) {
  invoiceContent = invoiceContent.replace(
    /<div style=\{\{ fontSize: fontMetrics\.headingSize, fontWeight: 'bold', lineHeight: '1\.15', textTransform: 'uppercase' \}\}>\s*\{activeSettings\.restaurantName \|\| 'MSBILLINGS'\}\s*<\/div>/,
    `<div style={{ fontSize: fontMetrics.headingSize, fontWeight: 'bold', lineHeight: '1.15', textTransform: 'uppercase' }}>
                {activeSettings.restaurantName || 'MSBILLINGS'}
              </div>
              {activeSettings.restaurantType && (
                <div style={{ fontSize: fontMetrics.detailSize, fontStyle: 'italic', marginTop: '2px', lineHeight: '1.2' }}>
                  {activeSettings.restaurantType}
                </div>
              )}`
  );

  // 80mm
  invoiceContent = invoiceContent.replace(
    /<div align="center" style=\{\{ fontSize: fontMetrics\.headingSize, lineHeight: '1\.15', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center', width: '100%', display: 'block' \}\}>\s*\{\(activeSettings\.restaurantName \|\| 'MSBILLINGS'\)\.toUpperCase\(\)\}\s*<\/div>/,
    `<div align="center" style={{ fontSize: fontMetrics.headingSize, lineHeight: '1.15', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center', width: '100%', display: 'block' }}>
                {(activeSettings.restaurantName || 'MSBILLINGS').toUpperCase()}
              </div>
              {activeSettings.restaurantType && (
                <div align="center" style={{ fontSize: fontMetrics.detailSize, fontStyle: 'italic', marginBottom: '4px', textAlign: 'center', width: '100%', display: 'block' }}>
                  {activeSettings.restaurantType}
                </div>
              )}`
  );

  fs.writeFileSync(invoicePath, invoiceContent, 'utf8');
  console.log('Fixed Invoice.jsx');
}
