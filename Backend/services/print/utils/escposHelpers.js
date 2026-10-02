import https from 'https';
import http from 'http';
import sharp from 'sharp';
import QRCode from 'qrcode';

// ESC/POS Commands
export const ESC = '\x1B';
export const GS = '\x1D';

export const CMD = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_RIGHT: ESC + 'a\x02',
  DOUBLE_STRIKE_ON: ESC + 'G\x01',
  DOUBLE_STRIKE_OFF: ESC + 'G\x00',
  TEXT_NORMAL: ESC + '!\x00' + GS + '!\x00' + ESC + 'E\x00' + ESC + 'G\x00',
  TEXT_DOUBLE_HEIGHT: GS + '!\x01' + ESC + '!\x10',
  TEXT_DOUBLE_WIDTH: GS + '!\x10' + ESC + '!\x20',
  TEXT_LARGE: GS + '!\x11' + ESC + '!\x30',
  TEXT_DOUBLE_HEIGHT_BOLD: ESC + '!\x18' + GS + '!\x01' + ESC + 'E\x01' + ESC + 'G\x01',
  TEXT_LARGE_BOLD: ESC + '!\x38' + GS + '!\x11' + ESC + 'E\x01' + ESC + 'G\x01',
  FONT_A: ESC + 'M\x00',
  FONT_B: ESC + 'M\x01',
  LINE_SPACING_DEFAULT: ESC + '2',
  LINE_SPACING_COMPACT: ESC + '3\x18',
  LINE_SPACING_RELAXED: ESC + '3\x26',
  BOLD_ON: ESC + '!\x08' + ESC + 'E\x01' + ESC + 'G\x01',
  BOLD_OFF: ESC + '!\x00' + ESC + 'E\x00' + ESC + 'G\x00',
  THICK_BOLD_ON: ESC + 'E\x01' + ESC + 'G\x01',
  THICK_BOLD_OFF: ESC + 'E\x00' + ESC + 'G\x00',
  CUT_PAPER: GS + 'V\x42\x00',
  LINE_FEED: '\n'
};

// In-memory cache for rasterized logos (key -> Buffer) for instant 0ms retrieval on subsequent prints
export const logoRasterCache = new Map();
// In-memory cache for menu item categories per tenant to avoid full collection scans on every print
export const categoryMapCache = new Map();

/**
 * Text wrapping helper for fixed width thermal receipt printers
 */
export const wrapTextLines = (text, maxChars) => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Two-column aligned row generator (Left aligned key, Right aligned value)
 */
export const formatTwoCols = (left, right, width = 48) => {
  const l = String(left || '');
  const r = String(right || '');
  if (l.length + r.length >= width) {
    return l + ' ' + r;
  }
  return l + ' '.repeat(width - l.length - r.length) + r;
};

/**
 * Generate a 1-bit monochrome ESC/POS raster bit image (GS v 0) for a QR Code
 */
export const generateESCPOSQRCodeRaster = (text, is58mm = true) => {
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
};

/**
 * Generate a 1-bit monochrome ESC/POS raster bit image (GS v 0) for a continuous solid divider line
 */
export const generateESCPOSSolidLine = (is58mm = false, thicknessDots = 2) => {
  const widthDots = is58mm ? 384 : 528;
  const widthBytes = widthDots / 8; // 48 bytes for 58mm, 66 bytes for 80mm
  const heightDots = Math.max(1, Math.min(8, thicknessDots));
  const data = Buffer.alloc(widthBytes * heightDots, 0xFF);

  const xL = widthBytes & 0xFF;
  const xH = (widthBytes >> 8) & 0xFF;
  const yL = heightDots & 0xFF;
  const yH = (heightDots >> 8) & 0xFF;

  const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([
    Buffer.from(CMD.ALIGN_LEFT, 'utf-8'),
    header,
    data,
    Buffer.from(CMD.LINE_FEED, 'utf-8')
  ]);
};

/**
 * Download and rasterize a restaurant logo into a 1-bit monochrome ESC/POS raster image (GS v 0)
 */
export const generateESCPOSLogoRaster = async (logoUrl, is58mm = false) => {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) return Buffer.alloc(0);

  const cacheKey = `${logoUrl.trim()}_${is58mm ? '58' : '80'}_medium_v3`;
  if (logoRasterCache.has(cacheKey)) {
    return logoRasterCache.get(cacheKey);
  }

  try {
    let imageBuffer;
    if (logoUrl.startsWith('data:image/')) {
      const base64Data = logoUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const client = logoUrl.startsWith('https') ? https : http;
      imageBuffer = await new Promise((resolve, reject) => {
        const req = client.get(logoUrl, { timeout: 3500 }, (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download logo: HTTP ${res.statusCode}`));
          }
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Logo download timed out'));
        });
      });
    } else {
      return Buffer.alloc(0);
    }

    // Medium logo size: 160 dots on 80mm (~20mm wide), 120 dots on 58mm (~15mm wide)
    const targetWidth = is58mm ? 120 : 160;
    const { data, info } = await sharp(imageBuffer)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColourspace('b-w')
      .threshold(180)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelWidth = info.width;
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
    ]);

    logoRasterCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[PrinterService] Error rasterizing logo for ESC/POS:', err.message);
    return Buffer.alloc(0);
  }
};
