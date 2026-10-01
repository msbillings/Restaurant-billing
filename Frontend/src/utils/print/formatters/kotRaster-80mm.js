import { renderElementToESCPOSRaster, renderElementToAndroidBluetoothPNG } from '../utils/rasterHelpers.js';

export const renderKOT80mm = async (element) => {
  return await renderElementToESCPOSRaster(element, 576);
};

export const renderKOT80mmForAndroid = async (element) => {
  return await renderElementToAndroidBluetoothPNG(element, 576);
};
