// Backwards compatibility layer for Frontend printing.
// Core logic moved to utils/print/utils/rasterHelpers.js

export { 
  renderElementToESCPOSRaster, 
  renderElementToAndroidBluetoothPNG as renderElementToPNGBase64,
  autoTrimCanvasBottom
} from './print/utils/rasterHelpers.js';
