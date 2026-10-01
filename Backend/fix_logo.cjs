const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'utils', 'escposHelpers.js');
let content = fs.readFileSync(filePath, 'utf8');

const regexLogo = /const pixelWidth = info\.width;[\s\S]*?Buffer\.from\(CMD\.LINE_FEED, 'utf-8'\)\n    \]\);/g;

const newLogoCode = `const pixelWidth = info.width;
    const pixelHeight = info.height;

    // Calculate exact center offset in dots
    const totalWidthDots = is58mm ? 384 : 528;
    const xOffset = Math.max(0, Math.floor((totalWidthDots - pixelWidth) / 2));
    const rightEdge = xOffset + pixelWidth;
    
    // Allocate buffer width up to the right edge of the logo (left padded, right truncated)
    const paddedWidthBytes = Math.ceil(rightEdge / 8);
    const dataBuffer = Buffer.alloc(paddedWidthBytes * pixelHeight, 0);

    for (let y = 0; y < pixelHeight; y++) {
      for (let x = 0; x < pixelWidth; x++) {
        const idx = y * pixelWidth + x;
        const isBlack = data[idx] < 128;
        if (isBlack) {
          const targetX = xOffset + x;
          const byteIndex = y * paddedWidthBytes + Math.floor(targetX / 8);
          const bitIndex = 7 - (targetX % 8);
          dataBuffer[byteIndex] |= (1 << bitIndex);
        }
      }
    }

    const xL = paddedWidthBytes & 0xFF;
    const xH = (paddedWidthBytes >> 8) & 0xFF;
    const yL = pixelHeight & 0xFF;
    const yH = (pixelHeight >> 8) & 0xFF;

    const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    
    const result = Buffer.concat([
      Buffer.from(CMD.ALIGN_LEFT, 'utf-8'),
      header,
      dataBuffer,
      Buffer.from(CMD.LINE_FEED, 'utf-8')
    ]);`;

content = content.replace(regexLogo, newLogoCode);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Applied hybrid logo padding strategy for ESC/POS');
