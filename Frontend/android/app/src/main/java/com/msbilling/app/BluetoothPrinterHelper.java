package com.msbilling.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

public class BluetoothPrinterHelper {
    private static final String TAG = "BluetoothPrinterHelper";
    // Standard SerialPort (SPP) Service UUID used by virtually all thermal Bluetooth printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final Context context;

    public BluetoothPrinterHelper(Context context) {
        this.context = context;
    }

    public boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Lists all bonded / paired Bluetooth devices
     */
    public String getPairedDevices() {
        JSONObject response = new JSONObject();
        JSONArray devicesArray = new JSONArray();

        try {
            if (!hasBluetoothPermission()) {
                response.put("success", false);
                response.put("error", "PERMISSION_REQUIRED");
                response.put("message", "Bluetooth permission is required. Please grant permission.");
                response.put("devices", devicesArray);
                return response.toString();
            }

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                response.put("success", false);
                response.put("error", "BLUETOOTH_UNAVAILABLE");
                response.put("message", "Bluetooth is not supported on this device.");
                response.put("devices", devicesArray);
                return response.toString();
            }

            if (!adapter.isEnabled()) {
                response.put("success", false);
                response.put("error", "BLUETOOTH_DISABLED");
                response.put("message", "Bluetooth is turned off. Please turn on Bluetooth.");
                response.put("devices", devicesArray);
                return response.toString();
            }

            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSONObject devObj = new JSONObject();
                    String name = device.getName();
                    if (name == null || name.trim().isEmpty()) {
                        name = "Unknown Bluetooth Device";
                    }
                    devObj.put("name", name);
                    devObj.put("address", device.getAddress());
                    devObj.put("type", device.getType());
                    devicesArray.put(devObj);
                }
            }

            response.put("success", true);
            response.put("devices", devicesArray);
        } catch (Exception e) {
            Log.e(TAG, "Error listing paired devices: ", e);
            try {
                response.put("success", false);
                response.put("error", e.getMessage());
                response.put("devices", devicesArray);
            } catch (Exception ignored) {}
        }

        return response.toString();
    }

    /**
     * Prints a test receipt to verify connection with the printer
     */
    public String testPrint(String address) {
        JSONObject response = new JSONObject();
        try {
            BluetoothSocket socket = connectToDevice(address);
            if (socket == null) {
                response.put("success", false);
                response.put("error", "Could not connect to Bluetooth printer. Ensure it is powered on and in range.");
                return response.toString();
            }

            OutputStream os = socket.getOutputStream();

            // ESC/POS Commands
            byte[] escInit = new byte[]{0x1B, 0x40}; // ESC @ (Initialize)
            byte[] alignCenter = new byte[]{0x1B, 0x61, 0x01}; // ESC a 1 (Center)
            byte[] alignLeft = new byte[]{0x1B, 0x61, 0x00}; // ESC a 0 (Left)
            byte[] boldOn = new byte[]{0x1B, 0x45, 0x01}; // ESC E 1
            byte[] boldOff = new byte[]{0x1B, 0x45, 0x00}; // ESC E 0
            byte[] doubleHeight = new byte[]{0x1D, 0x21, 0x01}; // Double height
            byte[] normalText = new byte[]{0x1D, 0x21, 0x00}; // Normal size
            byte[] feedAndCut = new byte[]{0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00}; // Feed 4 lines and cut

            os.write(escInit);
            os.write(alignCenter);
            os.write(boldOn);
            os.write(doubleHeight);
            os.write("MS BILLINGS\n".getBytes("UTF-8"));
            os.write(normalText);
            os.write(boldOff);
            os.write("Bluetooth Printer Connected\n".getBytes("UTF-8"));
            os.write("--------------------------------\n".getBytes("UTF-8"));
            os.write(alignLeft);
            os.write(("Device MAC: " + address + "\n").getBytes("UTF-8"));
            os.write(("Date/Time: " + new java.util.Date().toString() + "\n").getBytes("UTF-8"));
            os.write("Status: Ready to Print Receipts & KOT\n".getBytes("UTF-8"));
            os.write("--------------------------------\n".getBytes("UTF-8"));
            os.write(alignCenter);
            os.write("*** THANK YOU! ***\n".getBytes("UTF-8"));
            os.write(feedAndCut);
            os.flush();

            Thread.sleep(500);
            socket.close();

            response.put("success", true);
            response.put("message", "Test print sent successfully!");
        } catch (Exception e) {
            Log.e(TAG, "Test print error: ", e);
            try {
                response.put("success", false);
                response.put("error", e.getMessage());
            } catch (Exception ignored) {}
        }
        return response.toString();
    }

    /**
     * Converts a base64 encoded PNG image of the receipt into ESC/POS raster and prints it
     */
    public String printImage(String address, String base64Png, int paperWidthDots) {
        JSONObject response = new JSONObject();
        try {
            if (base64Png == null || base64Png.trim().isEmpty()) {
                response.put("success", false);
                response.put("error", "Image content is empty");
                return response.toString();
            }

            // Remove data URI prefix if present
            if (base64Png.contains(",")) {
                base64Png = base64Png.substring(base64Png.indexOf(",") + 1);
            }

            byte[] decoded = Base64.decode(base64Png, Base64.DEFAULT);
            Bitmap original = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            if (original == null) {
                response.put("success", false);
                response.put("error", "Failed to decode image");
                return response.toString();
            }

            // Determine target width: 384 for 58mm, 576 for 80mm
            int targetWidth = paperWidthDots > 0 ? paperWidthDots : 384;
            
            // Resize maintaining aspect ratio
            int targetHeight = (int) ((float) original.getHeight() * ((float) targetWidth / original.getWidth()));
            Bitmap scaledBitmap = Bitmap.createScaledBitmap(original, targetWidth, targetHeight, true);

            // Generate ESC/POS raster bytes
            byte[] rasterBytes = bitmapToEscPosRaster(scaledBitmap);

            BluetoothSocket socket = connectToDevice(address);
            if (socket == null) {
                response.put("success", false);
                response.put("error", "Could not connect to Bluetooth printer " + address);
                return response.toString();
            }

            OutputStream os = socket.getOutputStream();
            
            // Send in small chunks (1024 bytes) to avoid overflowing Bluetooth printer buffer
            int chunkSize = 1024;
            for (int i = 0; i < rasterBytes.length; i += chunkSize) {
                int len = Math.min(chunkSize, rasterBytes.length - i);
                os.write(rasterBytes, i, len);
                os.flush();
                Thread.sleep(15);
            }

            // Feed and cut
            byte[] feedAndCut = new byte[]{0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00};
            os.write(feedAndCut);
            os.flush();

            Thread.sleep(600);
            socket.close();

            response.put("success", true);
            response.put("message", "Print job sent successfully!");
        } catch (Exception e) {
            Log.e(TAG, "Print image error: ", e);
            try {
                response.put("success", false);
                response.put("error", e.getMessage());
            } catch (Exception ignored) {}
        }
        return response.toString();
    }

    /**
     * Converts a Bitmap into ESC/POS GS v 0 raster bit-image command
     */
    private byte[] bitmapToEscPosRaster(Bitmap bitmap) throws Exception {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int widthBytes = (width + 7) / 8;

        int xL = widthBytes % 256;
        int xH = widthBytes / 256;
        int yL = height % 256;
        int yH = height / 256;

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // 1. ESC @ (Initialize)
        baos.write(new byte[]{0x1B, 0x40});
        // 2. ESC a 1 (Center alignment)
        baos.write(new byte[]{0x1B, 0x61, 0x01});
        // 3. GS v 0 m xL xH yL yH
        baos.write(new byte[]{0x1D, 0x76, 0x30, 0x00, (byte) xL, (byte) xH, (byte) yL, (byte) yH});

        // 4. Pixel raster data
        for (int y = 0; y < height; y++) {
            for (int xByte = 0; xByte < widthBytes; xByte++) {
                int byteVal = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = xByte * 8 + bit;
                    if (x < width) {
                        int pixel = bitmap.getPixel(x, y);
                        int r = Color.red(pixel);
                        int g = Color.green(pixel);
                        int b = Color.blue(pixel);
                        int alpha = Color.alpha(pixel);

                        // If transparent or white, don't print dot
                        if (alpha < 50) {
                            // white
                        } else {
                            // Calculate luminance
                            int luminance = (int) (0.299 * r + 0.587 * g + 0.114 * b);
                            if (luminance < 190) { // Black dot threshold
                                byteVal |= (0x80 >> bit);
                            }
                        }
                    }
                }
                baos.write(byteVal);
            }
        }

        return baos.toByteArray();
    }

    private BluetoothSocket connectToDevice(String address) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) return null;

            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device == null) return null;

            // Try standard RFCOMM SPP socket
            BluetoothSocket socket = null;
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
                return socket;
            } catch (Exception e1) {
                Log.w(TAG, "Standard SPP connection failed, attempting fallback reflection socket: " + e1.getMessage());
                try {
                    // Fallback using reflection for older or non-standard Bluetooth stacks
                    socket = (BluetoothSocket) device.getClass()
                            .getMethod("createRfcommSocket", new Class[]{int.class})
                            .invoke(device, 1);
                    if (socket != null) {
                        socket.connect();
                        return socket;
                    }
                } catch (Exception e2) {
                    Log.e(TAG, "Fallback RFCOMM connection failed: ", e2);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to connect to device: ", e);
        }
        return null;
    }
}
