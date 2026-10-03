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
- [ ] `hello` info appears in More → Controller settings
- [ ] Zone run, stop and stop-all reach the board. The water ring counts down.
- [ ] Turning the board off shows "Connection lost. Reconnecting…". Turning it
      on again reconnects on its own (retries at 1 s, 2 s, 5 s, then every 10 s).
- [ ] Relaunching the app reconnects to the last controller (phones)
- [ ] The terminal shows firmware log lines over BLE

## USB serial (Android OTG, desktop)

- [ ] Test each adapter we ship: CH340, CP2102 (add FTDI if used)
- [ ] Android: plugging in the adapter offers to open JoME, and "Always" is remembered
- [ ] Android: *Connect with USB cable* asks for USB permission once, then connects
- [ ] Android: with no adapter plugged in, the app says to connect a USB OTG cable
- [ ] Changing the baud rate in the terminal works
- [ ] Unplugging the cable shows the banner without crashing
- [ ] On iOS, the Connect screen offers no USB option

## Provisioning

- [ ] Wi‑Fi scan lists networks with signal strength
- [ ] A wrong password shows `wifi.state: failed` with its reason
- [ ] A correct password shows "connected" and the IP address

## Server registration (board with factory values, signed in)

- [ ] After the claim, *Connecting JoME…* walks through registering and connecting, then Name
- [ ] The terminal shows `server.set` with the token hidden (`••••`), never the token
- [ ] With no Wi‑Fi: the screen says to connect the board to Wi‑Fi first (`NO_NETWORK`); *Skip for now* works
- [ ] A used token (open the app on two phones, register twice): *The setup code expired or was already used*, and *Try again* succeeds
- [ ] A board with a wrong registration code: *JoME's own code was refused*
- [ ] A board that belongs to another account: *This JoME belongs to another account*
- [ ] A development board (`shambe-…` serial) says it can't join an account and continues to Name
- [ ] Device tab → *JoME's server*: *Online* after the board is registered; *Not reported* right after connecting nearby until the board says something
- [ ] Powering the router off shows *Needs attention*, *JoME couldn't reach the server*; it returns to *Online* on its own
- [ ] Removing the board from the account (another phone, once available) shows *Needs attention*, *The server removed JoME…*; *Connect again* registers it and it goes *Online*

