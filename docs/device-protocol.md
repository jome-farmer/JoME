# Device link and protocol (v1, draft)

This file is the **contract between the app and the board firmware**. Change it
in the same PR as the code that depends on it. Bump `proto` when a change
breaks compatibility.

## 1. One byte stream, three transports

The board exposes a single bidirectional byte stream. The app sees it as a
`Link`, the same interface on every transport:

| Transport | Physical | Used on |
|---|---|---|
| **BLE** | Nordic UART Service (NUS) | Android, iOS, desktop Chrome |
| **USB serial** | Board UART → USB‑TTL adapter, 115200 8N1 by default | Android (OTG), desktop Chrome (Web Serial) |
| **Mock** | In-memory simulated board | Development, tests, demos |

### BLE: Nordic UART Service

| | UUID | Properties |
|---|---|---|
| Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` | |
| RX (app → board) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | write / write-without-response |
| TX (board → app) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` | notify |

- Advertised name: `JoME-<last 4 of serial>`, for example `JoME-0001`.
- The app splits writes to `MTU − 3` bytes. Android requests the largest MTU
  automatically. iOS negotiates its own. Web Bluetooth can't read the MTU, so
  it uses 20-byte writes.
- Writes use *write with response*, so the board can't silently drop a chunk.
- **Security:** Wi‑Fi credentials travel over this link, so the board requires
  LE Secure Connections bonding with a 6-digit passkey on its characteristics.
  The passkey is printed on the device label and encoded in its QR code (see §4).
  The **operating system** asks for it in its own pairing dialog the first time
  the app touches the service. Apps can't fill in that dialog, so the app shows
  the passkey (from the QR code) for the user to type.

We chose NUS because it is the de-facto BLE "serial port". Generic BLE
terminal apps (nRF Connect, Serial Bluetooth Terminal) can talk to the board
with no extra work, which helps firmware developers.

## 2. Framing: newline-delimited JSON, mixed with logs

- The stream is UTF‑8 text split into lines by `\n`. The app ignores `\r`.
- A line that starts with `{` is a **protocol message** (one JSON object).
- Any other line is a **log line**. The app shows it in the terminal and
  ignores it everywhere else.

This keeps the USB‑TTL port useful in a plain serial monitor. Firmware logs and
app traffic share the wire and stay readable.

## 3. Messages

Request, sent by the app:

```json
{"id": 12, "cmd": "zone.run", "args": {"zone": 3, "seconds": 600}}
```

Response, sent by the board with the same `id`:

```json
{"id": 12, "ok": true, "data": {}}
{"id": 12, "ok": false, "error": {"code": "ZONE_BUSY", "message": "Zone 2 is running"}}
```

Event, sent by the board without being asked (no `id`):

```json
{"evt": "zone.state", "data": {"zone": 3, "state": "watering", "remaining": 598}}
```

- `id` is an integer the app chooses, unique per open link.
- The app times out requests after 5 s by default (`wifi.scan`: 15 s).

### Commands (v1)

| `cmd` | `args` | `data` returned |
|---|---|---|
| `hello` | `{}` | `{proto, fw, hw, serial, name, zoneCount}` |
| `time.set` | `{epoch, tz}` | `{}` (the app sends this on every connect because the board may lack an RTC) |
| `status` | `{}` | `Status` (below) |
| `wifi.scan` | `{}` | `{networks: [{ssid, rssi, secure}]}` |
| `wifi.set` | `{ssid, password}` | `{}` (outcome arrives as `wifi.state` events) |
| `zones.list` | `{}` | `{zones: [{zone, name, enabled, defaultSeconds}]}` |
| `zone.update` | `{zone, name?, enabled?, defaultSeconds?}` | `{}` |
| `zone.run` | `{zone, seconds}` | `{}` |
| `zone.stop` | `{zone}` | `{}` |
| `stop.all` | `{}` | `{}` |
| `programs.list` | `{}` | `{programs: [Program]}` |
| `program.save` | `Program` | `{id}` |
| `program.delete` | `{id}` | `{}` |
| `rain.delay` | `{hours}` (0 clears it) | `{until}` (epoch s, or `null` when cleared) |
| `device.rename` | `{name}` | `{}` |

```ts
type Program = {
  id?: number;
  name: string;
  enabled: boolean;
  days: number[];          // 0 = Sunday … 6 = Saturday
  start: string;           // "HH:MM", device local time
  steps: { zone: number; seconds: number }[]; // run in order
};

type Status = {
  wifi: { state: "disconnected" | "connecting" | "connected" | "failed"; ssid?: string; ip?: string; reason?: string };
  rainDelayUntil: number | null;                        // epoch seconds
  running: { zone: number; remaining: number }[];       // remaining in seconds
  nextRun: { program: number; name: string; at: number } | null; // at: epoch seconds
};
```

All times are **epoch seconds**. Durations are **seconds**. The app's
TypeScript mirror of this section is `src/device/types.ts`.

### Events

| `evt` | `data` |
|---|---|
| `zone.state` | `{zone, state: "idle" \| "watering" \| "disabled", remaining?}` |
| `wifi.state` | `Status.wifi` |
| `status` | same shape as the `status` response, sent on change |

### Error codes

`BAD_REQUEST`, `UNKNOWN_CMD`, `ZONE_BUSY`, `NOT_FOUND`, `WIFI_FAILED`,
`INTERNAL`.

## 4. QR code on the device label

```
jome://pair?s=JM-2024-0001&k=483920
```

`s` is the serial number, which the app uses to find the matching BLE
advertisement. `k` is the BLE passkey, which the app shows large while the
system pairing dialog is open. Scanning the QR code is a shortcut. A user
without a camera, or on desktop, picks the device from the scan list and reads
the passkey from the label.

## Open questions for firmware

- Which MCU runs the board? This design assumes an **ESP32-class** chip with
  BLE and Wi‑Fi.
- Does anything other than local control use Wi‑Fi (cloud or MQTT)? If so, we
  add a `WebSocketLink` with the same framing, and nothing above the link
  changes.
- Can the board hold at least 16 zones and 8 programs in flash?
