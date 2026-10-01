import { renderElementToESCPOSRaster, renderElementToAndroidBluetoothPNG } from '../utils/rasterHelpers.js';

export const renderBill58mm = async (element) => {
  return await renderElementToESCPOSRaster(element, 384);
};

export const renderBill58mmForAndroid = async (element) => {
  return await renderElementToAndroidBluetoothPNG(element, 384);
};
