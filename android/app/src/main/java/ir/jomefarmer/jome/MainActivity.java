package ir.jomefarmer.jome;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate().
        registerPlugin(UsbSerialPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
