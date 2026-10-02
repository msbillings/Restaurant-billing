import { renderElementToESCPOSRaster, renderElementToAndroidBluetoothPNG } from '../utils/rasterHelpers.js';

export const renderKOT58mm = async (element) => {
  return await renderElementToESCPOSRaster(element, 384);
};

export const renderKOT58mmForAndroid = async (element) => {
  return await renderElementToAndroidBluetoothPNG(element, 384);
};
