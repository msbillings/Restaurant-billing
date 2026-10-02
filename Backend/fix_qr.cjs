const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'restaurant', 'Restaurant-billing', 'Backend', 'services', 'print', 'utils', 'escposHelpers.js');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /export const generateESCPOSQRCodeRaster = \(text, is58mm = true\) => \{[\s\S]*?\} catch \(err\) \{\n    console\.error\('\[PrinterService\] Error generating ESC\/POS QR raster:', err\);\n    return Buffer\.alloc\(0\);\n  \}\n\};/g;

const newCode = `export const generateESCPOSQRCodeRaster = (text, is58mm = true) => {
  if (!text || typeof text !== 'string') return Buffer.alloc(0);

  try {
    const len = text.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    
    const qrSize = is58mm ? 0x05 : 0x06;

    return Buffer.concat([
      Buffer.from(CMD.ALIGN_CENTER, 'utf-8'),
      Buffer.from([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, qrSize]),
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]),
      Buffer.from([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
      Buffer.from(text, 'utf-8'),
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),
      Buffer.from(CMD.LINE_FEED + CMD.LINE_FEED, 'utf-8'),
      Buffer.from(CMD.ALIGN_LEFT, 'utf-8')
    ]);
  } catch (err) {
    console.error('[PrinterService] Error generating ESC/POS QR raster:', err);
    return Buffer.alloc(0);
  }
};`;

content = content.replace(regex, newCode);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed QR code rendering speed in escposHelpers.js');
