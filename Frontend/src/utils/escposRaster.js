import html2canvas from 'html2canvas-pro';

/**
 * Converts a rendered DOM receipt element into a high-contrast 1-bit ESC/POS Raster Buffer (Base64)
 * This guarantees that thermal printers print pixel-perfect output identical to the UI:
 * - Exact fonts, exact font weights (light, medium, bold, black)
 * - Exact font sizes
 * - Restaurant logo image
 * - Clean solid dividers and borders
 * - High-contrast QR codes
 * 
 * @param {HTMLElement} element - The DOM node to capture (.receipt-print)
 * @param {number} targetWidthDots - 384 for 58mm (2-inch), 576 for 80mm (3-inch)
 * @returns {Promise<string>} Base64-encoded ESC/POS binary buffer
 */
export async function renderElementToESCPOSRaster(element, targetWidthDots = 576) {
  if (!element) return null;

  try {
    // Ensure we ONLY capture the actual receipt slip card, never any dark modal backdrop or overlay
    const targetElement = element.classList?.contains('receipt-print')
      ? element
      : (element.querySelector?.('.receipt-print') || element.querySelector?.('#kot-receipt-slip') || element);

    // 1. Capture DOM element using html2canvas-pro at high scale for crisp text
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      onclone: (clonedDoc) => {
        const receipt = clonedDoc.querySelector('.receipt-print') || clonedDoc.querySelector('#kot-receipt-slip') || clonedDoc.body;
        if (receipt) {
          receipt.style.boxShadow = 'none';
          receipt.style.filter = 'none';
          receipt.style.backgroundColor = '#ffffff';
          receipt.style.color = '#000000';
          receipt.style.border = 'none';
          receipt.style.margin = '0';
        }
      }
    });

    // 2. Scale canvas to exact printer dot width (384 for 58mm or 576 for 80mm)
    const targetWidth = targetWidthDots;
    const aspectRatio = canvas.height / canvas.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetWidth;
    scaledCanvas.height = targetHeight;
    const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true });

    // Pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // 3. Extract RGBA pixel data
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const pixels = imgData.data;

    // Auto-detect the last row containing visible text/content (non-white)
    let lastContentY = 0;
    for (let y = targetHeight - 1; y >= 0; y--) {
      let hasContentOnRow = false;
      for (let x = 0; x < targetWidth; x++) {
        const idx = (y * targetWidth + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];
        if (a > 50) {
          const luminance = r * 0.299 + g * 0.587 + b * 0.114;
          if (luminance < 205) {
            hasContentOnRow = true;
            break;
          }
        }
      }
      if (hasContentOnRow) {
        lastContentY = y;
        break;
      }
    }

    // Trim height to the last content row plus a tiny 6-pixel (~0.75mm) margin to eliminate bottom white waste
    const activeHeight = lastContentY > 0 ? Math.min(targetHeight, lastContentY + 6) : targetHeight;

    // 4. Convert to 1-bit monochrome raster ESC/POS commands
    // Print in chunks to prevent overflowing the thermal printer's small receive buffer (especially on Bluetooth)
    const CHUNK_ROWS = 256; // 256 rows is optimal: smooth printing without crashing standard 4KB buffers
    const bytesPerLine = Math.ceil(targetWidth / 8);
    const xL = bytesPerLine & 0xFF;
    const xH = (bytesPerLine >> 8) & 0xFF;

    const chunks = [];

    // ESC @ (Initialize printer) + ESC a 1 (Center align)
    chunks.push(new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x01]));

    for (let startY = 0; startY < activeHeight; startY += CHUNK_ROWS) {
      const chunkHeight = Math.min(CHUNK_ROWS, activeHeight - startY);
      const yL = chunkHeight & 0xFF;
      const yH = (chunkHeight >> 8) & 0xFF;

      // Command: GS v 0 0 xL xH yL yH
      const header = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];
      const dataBytes = new Uint8Array(header.length + bytesPerLine * chunkHeight);
      dataBytes.set(header, 0);

      let offset = header.length;
      for (let y = 0; y < chunkHeight; y++) {
        const currentY = startY + y;
        for (let xByte = 0; xByte < bytesPerLine; xByte++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = xByte * 8 + bit;
            if (x < targetWidth) {
              const idx = (currentY * targetWidth + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];

              // If transparent or pure white, leave white (0)
              if (a > 50) {
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                // High-contrast threshold: text and dark pixels become black dot (1)
                if (luminance < 195) {
                  byteVal |= (0x80 >> bit);
                }
              }
            }
          }
          dataBytes[offset++] = byteVal;
        }
      }
      chunks.push(dataBytes);
    }

    // Footer: Full Paper Cut (\x1d\x56\x42\x00) with no redundant blank feeds
    chunks.push(new Uint8Array([0x1D, 0x56, 0x42, 0x00]));

    // Combine all chunks into one continuous binary buffer
    let totalLength = 0;
    for (const c of chunks) totalLength += c.length;

    const combined = new Uint8Array(totalLength);
    let pos = 0;
    for (const c of chunks) {
      combined.set(c, pos);
      pos += c.length;
    }

    // Convert binary to base64 safely in 8KB chunks
    let binary = '';
    const CHUNK_SIZE = 8192;
    for (let i = 0; i < combined.length; i += CHUNK_SIZE) {
      const slice = combined.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  } catch (err) {
    console.error('[renderElementToESCPOSRaster] Error:', err);
    return null;
  }
}

/**
 * Automatically trims trailing pure-white space from a canvas to prevent bottom paper waste
 */
export function autoTrimCanvasBottom(canvas) {
  if (!canvas || canvas.height <= 0 || canvas.width <= 0) return canvas;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    let lastContentY = 0;
    for (let y = canvas.height - 1; y >= 0; y--) {
      let hasContent = false;
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const a = pixels[idx + 3];
        if (a > 50) {
          const lum = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
          if (lum < 210) {
            hasContent = true;
            break;
          }
        }
      }
      if (hasContent) {
        lastContentY = y;
        break;
      }
    }

    if (lastContentY <= 0 || lastContentY >= canvas.height - 10) {
      return canvas;
    }

    const trimmedHeight = Math.min(canvas.height, lastContentY + 12);
    const trimmed = document.createElement('canvas');
    trimmed.width = canvas.width;
    trimmed.height = trimmedHeight;
    const tCtx = trimmed.getContext('2d');
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, trimmed.width, trimmed.height);
    tCtx.drawImage(canvas, 0, 0, canvas.width, trimmedHeight, 0, 0, canvas.width, trimmedHeight);
    return trimmed;
  } catch (err) {
    console.warn('[autoTrimCanvasBottom] Fallback to original canvas:', err);
    return canvas;
  }
}
