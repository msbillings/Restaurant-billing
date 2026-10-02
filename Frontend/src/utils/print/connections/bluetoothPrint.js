export const triggerBluetoothPrint = () => {
  if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
    window.AndroidPrint.print();
    return true;
  }
  throw new Error("Bluetooth Printing is only available on Android.");
};
