package ir.jomefarmer.jome;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

/**
 * USB‑TTL serial over USB OTG, for src/device/links/androidUsbLink.ts.
 * Wraps usb-serial-for-android (CH340, CP210x, FTDI, PL2303, CDC‑ACM). One open port at a time.
 * Events: "data" {data: base64}, "closed" {error} when the port drops unexpectedly.
 */
@CapacitorPlugin(name = "UsbSerial")
public class UsbSerialPlugin extends Plugin implements SerialInputOutputManager.Listener {

    private static final String ACTION_PERMISSION = "ir.jomefarmer.jome.USB_PERMISSION";
    private static final int WRITE_TIMEOUT_MS = 2000;

    private UsbSerialPort port;
    private SerialInputOutputManager io;
    private int openDeviceId = -1;
    private boolean closing = false;

    private final BroadcastReceiver detachReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (device != null && device.getDeviceId() == openDeviceId) {
                closePort("The USB cable was disconnected");
            }
        }
    };

    @Override
    public void load() {
        ContextCompat.registerReceiver(
            getContext(),
            detachReceiver,
            new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        closePort(null);
        try {
            getContext().unregisterReceiver(detachReceiver);
        } catch (IllegalArgumentException ignored) {
            // Already unregistered.
        }
    }

    private UsbManager manager() {
        return (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    private UsbSerialDriver findDriver(int deviceId) {
        for (UsbSerialDriver d : UsbSerialProber.getDefaultProber().findAllDrivers(manager())) {
            if (d.getDevice().getDeviceId() == deviceId) return d;
        }
        return null;
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSArray devices = new JSArray();
        for (UsbSerialDriver d : UsbSerialProber.getDefaultProber().findAllDrivers(manager())) {
            UsbDevice dev = d.getDevice();
            JSObject o = new JSObject();
            o.put("deviceId", dev.getDeviceId());
            o.put("vendorId", dev.getVendorId());
            o.put("productId", dev.getProductId());
            String name = null;
            try {
                name = dev.getProductName(); // May need permission on some Android versions.
            } catch (SecurityException ignored) {
            }
            o.put("name", name != null ? name : d.getClass().getSimpleName().replace("SerialDriver", " adapter"));
            devices.put(o);
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        Integer deviceId = call.getInt("deviceId");
        int baudRate = call.getInt("baudRate", 115200);
        UsbSerialDriver driver = deviceId == null ? null : findDriver(deviceId);
        if (driver == null) {
            call.reject("The USB adapter isn't connected any more", "NOT_FOUND");
            return;
        }
        UsbDevice device = driver.getDevice();
        if (manager().hasPermission(device)) {
            openDriver(call, driver, baudRate);
            return;
        }
        requestPermission(device, granted -> {
            if (granted) openDriver(call, driver, baudRate);
            else call.reject("Permission to use the USB adapter was denied", "PERMISSION_DENIED");
        });
    }

    private interface PermissionResult {
        void onResult(boolean granted);
    }

    private void requestPermission(UsbDevice device, PermissionResult result) {
        Context ctx = getContext();
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                ctx.unregisterReceiver(this);
                result.onResult(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false));
            }
        };
        ContextCompat.registerReceiver(ctx, receiver, new IntentFilter(ACTION_PERMISSION), ContextCompat.RECEIVER_NOT_EXPORTED);
        // Explicit package + mutable: required on Android 12+ so the system can add the result extras.
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        Intent intent = new Intent(ACTION_PERMISSION).setPackage(ctx.getPackageName());
        manager().requestPermission(device, PendingIntent.getBroadcast(ctx, 0, intent, flags));
    }

    private void openDriver(PluginCall call, UsbSerialDriver driver, int baudRate) {
        closePort(null);
        UsbDeviceConnection connection = manager().openDevice(driver.getDevice());
        if (connection == null) {
            call.reject("Couldn't open the USB adapter", "OPEN_FAILED");
            return;
        }
        try {
            UsbSerialPort p = driver.getPorts().get(0);
            p.open(connection);
            p.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            port = p;
            openDeviceId = driver.getDevice().getDeviceId();
            closing = false;
            io = new SerialInputOutputManager(p, this);
            io.start();
            call.resolve();
        } catch (Exception e) {
            closePort(null);
            call.reject("Couldn't open the USB adapter: " + e.getMessage(), "OPEN_FAILED");
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        UsbSerialPort p = port;
        if (p == null) {
            call.reject("Not connected over USB", "NOT_OPEN");
            return;
        }
        try {
            p.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT), WRITE_TIMEOUT_MS);
            call.resolve();
        } catch (Exception e) {
            call.reject("USB write failed: " + e.getMessage(), "WRITE_FAILED");
        }
    }

    @PluginMethod
    public void close(PluginCall call) {
        closePort(null);
        call.resolve();
    }

    @Override
    public void onNewData(byte[] data) {
        JSObject o = new JSObject();
        o.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        notifyListeners("data", o);
    }

    @Override
    public void onRunError(Exception e) {
        if (!closing) closePort("USB connection lost: " + e.getMessage());
    }

    /** error == null: closed on request, no event. Otherwise tell JS the port dropped. */
    private synchronized void closePort(String error) {
        if (port == null) return;
        closing = true;
        if (io != null) {
            io.stop();
            io = null;
        }
        try {
            port.close();
        } catch (Exception ignored) {
        }
        port = null;
        openDeviceId = -1;
        if (error != null) {
            JSObject o = new JSObject();
            o.put("error", error);
            notifyListeners("closed", o);
        }
    }
}
