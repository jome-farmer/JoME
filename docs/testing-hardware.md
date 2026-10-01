# Hardware test checklist

Run this on real devices on the `release/*` branch before tagging. Copy the
list into the release PR and tick each item.

## Devices

- [ ] iPhone, the lowest iOS version we support
- [ ] Android phone with USB‑C OTG
- [ ] Desktop Chrome or Edge

## BLE (all three)

- [ ] Scan finds `JoME-XXXX` within 5 s
- [ ] The system pairing dialog appears on first connect. The right passkey pairs. A wrong one shows a clear error in the app.
- [ ] QR scan finds the device, shows its passkey large, and connects (phones)
- [ ] Scanning a non-JoME QR code shows "That QR code isn't a JoME label"
- [ ] With the board powered off, a scan gives up after 20 s with a clear message
- [ ] `hello` info appears on the Device tab
- [ ] Zone run, stop and stop-all reach the board. The water ring counts down.
- [ ] Turning the board off shows "Connection lost. Reconnecting…". Turning it
      on again reconnects on its own (retries at 1 s, 2 s, 5 s, then every 10 s).
- [ ] Relaunching the app reconnects to the last controller (phones)
- [ ] The terminal shows firmware log lines over BLE

## USB serial (Android OTG, desktop)

- [ ] Test each adapter we ship: CH340, CP2102 (add FTDI if used)
- [ ] Android: plugging in the adapter offers to open JoME, and "Always" is remembered
- [ ] Android: _Connect with USB cable_ asks for USB permission once, then connects
- [ ] Android: with no adapter plugged in, the app says to connect a USB OTG cable
- [ ] Changing the baud rate in the terminal works
- [ ] Unplugging the cable shows the banner without crashing
- [ ] On iOS, the Connect screen offers no USB option

## Provisioning

- [ ] Wi‑Fi scan lists networks with signal strength
- [ ] A wrong password shows `wifi.state: failed` with its reason
- [ ] A correct password shows "connected" and the IP address
