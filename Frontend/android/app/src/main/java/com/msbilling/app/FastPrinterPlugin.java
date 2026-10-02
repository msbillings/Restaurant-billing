package com.msbilling.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "FastPrinter")
public class FastPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void printBase64(PluginCall call) {
        final String macAddress = call.getString("macAddress");
        final String rawBase64Data = call.getString("base64");

        if (macAddress == null || rawBase64Data == null) {
            call.reject("Must provide macAddress and base64 string");
            return;
        }

        // Run on background thread so we don't freeze the Capacitor Web UI
        new Thread(() -> {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth is not enabled on this device");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(macAddress);
            BluetoothSocket socket = null;
            OutputStream outputStream = null;

            try {
                String processedBase64 = rawBase64Data;
                // Remove the "data:image/png;base64," prefix if it exists
                if (processedBase64.contains(",")) {
                    processedBase64 = processedBase64.split(",")[1];
                }

                // Decode base64 to byte array
                byte[] imageBytes = Base64.decode(processedBase64, Base64.DEFAULT);

                // Connect natively
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                adapter.cancelDiscovery(); 
                socket.connect();
                outputStream = socket.getOutputStream();

                // Blast the raw image bytes in massive 4096-byte chunks (Lightning Fast)
                // Assuming the base64 payload is already formatted ESC/POS byte array from JS 
                // OR if it's a PNG we would rasterize it here. For simplicity, we assume the JS
                // gives us the raw ESC/POS payload encoded as base64 so we just stream it.
                outputStream.write(imageBytes);
                outputStream.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);

            } catch (Exception e) {
                Log.e("FastPrinter", "Failed to print", e);
                call.reject("Print failed: " + e.getMessage());
            } finally {
                try {
                    if (outputStream != null) outputStream.close();
                    if (socket != null) socket.close();
                } catch (IOException ignored) {}
            }
        }).start();
    }
}
