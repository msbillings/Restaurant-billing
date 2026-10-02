const fs = require('fs');
const path = require('path');

// 1. Fix escposHelpers.js (Logo Raster Optimization)
const escposPath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'utils', 'escposHelpers.js');
let escposContent = fs.readFileSync(escposPath, 'utf8');

const regexLogo = /const pixelWidth = info\.width;[\s\S]*?Buffer\.from\(CMD\.LINE_FEED, 'utf-8'\)\n    \]\);/g;

const newLogoCode = `const pixelWidth = info.width;
    const pixelHeight = info.height;
    
    // Only allocate bytes for the image width, don't pad to full paper width!
    const imageWidthBytes = Math.ceil(pixelWidth / 8);
    const dataBuffer = Buffer.alloc(imageWidthBytes * pixelHeight, 0);

    for (let y = 0; y < pixelHeight; y++) {
      for (let x = 0; x < pixelWidth; x++) {
        const idx = y * pixelWidth + x;
        const isBlack = data[idx] < 128;
        if (isBlack) {
          const byteIndex = y * imageWidthBytes + Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          dataBuffer[byteIndex] |= (1 << bitIndex);
        }
      }
    }

    const xL = imageWidthBytes & 0xFF;
    const xH = (imageWidthBytes >> 8) & 0xFF;
    const yL = pixelHeight & 0xFF;
    const yH = (pixelHeight >> 8) & 0xFF;

    const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    const result = Buffer.concat([
      Buffer.from(CMD.ALIGN_CENTER, 'utf-8'),
      header,
      dataBuffer,
      Buffer.from(CMD.LINE_FEED, 'utf-8')
    ]);`;

escposContent = escposContent.replace(regexLogo, newLogoCode);
fs.writeFileSync(escposPath, escposContent, 'utf8');
console.log('Optimized logo raster sizing in escposHelpers.js');

// 2. Fix bill-80mm.js
const bill80Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-80mm.js');
let bill80Content = fs.readFileSync(bill80Path, 'utf8');
bill80Content = bill80Content.replace(/const grandTotalCols = \d+;/g, 'const grandTotalCols = width;');
fs.writeFileSync(bill80Path, bill80Content, 'utf8');
console.log('Fixed Grand Total thermal alignment in bill-80mm.js');

// 3. Fix bill-58mm.js
const bill58Path = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'formatters', 'bill-58mm.js');
let bill58Content = fs.readFileSync(bill58Path, 'utf8');
bill58Content = bill58Content.replace(/const grandTotalCols = \d+;/g, 'const grandTotalCols = width;');
fs.writeFileSync(bill58Path, bill58Content, 'utf8');
console.log('Fixed Grand Total thermal alignment in bill-58mm.js');
