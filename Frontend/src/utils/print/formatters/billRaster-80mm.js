import { renderElementToESCPOSRaster, renderElementToAndroidBluetoothPNG } from '../utils/rasterHelpers.js';

export const renderBill80mm = async (element) => {
  return await renderElementToESCPOSRaster(element, 576);
};

export const renderBill80mmForAndroid = async (element) => {
  return await renderElementToAndroidBluetoothPNG(element, 576);
};
