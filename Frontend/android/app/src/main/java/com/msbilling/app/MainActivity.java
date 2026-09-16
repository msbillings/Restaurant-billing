package com.msbilling.app;

import android.Manifest;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private BluetoothPrinterHelper bluetoothPrinterHelper;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bluetoothPrinterHelper = new BluetoothPrinterHelper(this);
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        request.grant(request.getResources());
                    });
                }
            });

            // Standard Android System Print Service
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void print() {
                    runOnUiThread(() -> {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("MSBilling_Receipt");
                            String jobName = "MSBilling_Document";
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    });
                }
            }, "AndroidPrint");

            // Direct Native Bluetooth Thermal Printer Interface
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String getPairedDevices() {
                    return bluetoothPrinterHelper.getPairedDevices();
                }

                @JavascriptInterface
                public String printImage(String address, String base64Png, int paperWidthDots) {
                    return bluetoothPrinterHelper.printImage(address, base64Png, paperWidthDots);
                }

                @JavascriptInterface
                public String testPrint(String address) {
                    return bluetoothPrinterHelper.testPrint(address);
                }

                @JavascriptInterface
                public boolean hasPermission() {
                    return bluetoothPrinterHelper.hasBluetoothPermission();
                }

                @JavascriptInterface
                public void requestPermissions() {
                    runOnUiThread(() -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            ActivityCompat.requestPermissions(MainActivity.this, new String[]{
                                    Manifest.permission.BLUETOOTH_CONNECT,
                                    Manifest.permission.BLUETOOTH_SCAN
                            }, 1002);
                        }
                    });
                }
            }, "AndroidBluetooth");
        }
    }
}
