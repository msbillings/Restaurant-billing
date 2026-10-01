export const triggerUSBPrint = async (data) => {
  if (window.electronAPI && typeof window.electronAPI.print === 'function') {
    return await window.electronAPI.print(data);
  }
  throw new Error("USB Printing is only available in the Desktop App.");
};
