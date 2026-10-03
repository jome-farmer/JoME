# Device protocol

**The contract lives in [jome-farmer/protocol](https://github.com/jome-farmer/protocol)**
(`protocol.md`). It is shared by the app, the board firmware (SHamBE) and the
server (DouSHamBE), and it covers transports, the message format, every
command, events, types, error codes, limits, the QR label, and the rules for
changing any of them. Read it before touching `src/services/device/`.

To change the protocol, open a PR there first and link it to the matching
firmware and app PRs. `src/services/device/types.ts` mirrors its types.

This page only covers how the app implements it.

## Links

Every transport is a `Link` (`src/services/device/links/link.ts`), a byte stream with the
same interface. Features never touch a link directly. They go through
`DeviceClient`.

| Link                | File                      | Platforms                     |
| ------------------- | ------------------------- | ----------------------------- |
| BLE (Nordic UART)   | `links/bleLink.ts`        | Android, iOS, desktop Chrome  |
| USB serial, Android | `links/androidUsbLink.ts` | Android (OTG)                 |
| USB serial, Web     | `links/webSerialLink.ts`  | desktop Chrome/Edge           |
| Demo board          | `links/mockLink.ts`       | everywhere (Demo mode, tests) |

- **iOS has no USB serial** (MFi). Hide USB options there.
- **BLE writes** are split into `MTU − 3` byte chunks, at most 512 bytes (the
  longest attribute value; Android drops longer ones). Android requests the
  largest MTU. iOS negotiates its own. Web Bluetooth can't read the MTU, so it
  uses 20 bytes. Writes use _with response_, so the board can't silently drop
  a chunk.
- **Pairing:** the OS shows its own passkey dialog the first time the app
  writes. Apps can't fill it in, so the app shows the passkey from the QR label
  large while the dialog is open.

## Client

- `lineCodec.ts` splits bytes into lines. Lines starting with `{` are
  messages, and everything else is a log line for the terminal.
- `client.ts` matches responses to requests by `id`, fans out events, and
  times requests out (5 s; 15 s for `wifi.scan`, `zones.list` and
  `programs.list`, whose replies are long and queue behind others at startup).
- `handshake.ts` runs on every connect: `hello` (refuses other `proto`), then
  `time.set` with the phone's clock and IANA zone.
- Feature-detect optional actions with the required `hello.cmds` list rather
  than the firmware version. The connection refuses a board missing the app's
  baseline commands, and screens hide optional actions it does not list.
- Messages over **16 KiB** are refused in the app with `BAD_REQUEST`,
  because the board drops them without answering (protocol §2).
- People see the app's own words for each error `code` (`services/device/errors.ts`),
  never the board's English `message`. Unknown codes get a generic line.
- The `restart()` thunk in `store/deviceSlice.ts` sends `device.reboot` and reconnects once the
  board is back. Bluetooth does this through its normal automatic reconnect.

## Wi‑Fi

- Failure `reason`s are ESP-IDF codes. `wifiFailureText` says what they mean:
  `AUTH_FAIL` and the handshake timeouts mean a wrong password, and
  `NO_AP_FOUND` means the board can't see the network.
- Serials can be lower case (`shambe-a1b2c3`), so serials and advertised
  names are compared case-insensitively.

## Server link

- `server.set {url, token}` is local only (BLE and USB). The client's traffic
  log hides the token (`redact`). Errors: `BAD_REQUEST`, `NO_NETWORK`,
  `CLOCK_NOT_SET`. The outcome comes as `server.state` events, which
  `registerBoard` follows until `online` or `failed`.
- The latest `server.state` is kept in `deviceSlice` (`server`) for the Device tab. The
  board sends it on change only, so it is unknown after connecting until one arrives;
  through the server the app already knows the board is online.
- `serverStateText` words every `server.state` and every `failed` reason
  (protocol §4); an unknown reason stays generic.

## Demo board

`mockLink.ts` simulates a board, with the same commands, events, error codes
and limits as the real one. Keep it in step with the protocol repo when either
changes.

- `createMockLink()` implements the current v1 zones-and-valves model.
- Like the real board: no next run and no rain delay until `time.set`
  (`CLOCK_NOT_SET`), `device.reboot` drops the link, and Wi‑Fi failures use
  ESP-IDF reasons.
- The Demo mode keeps one board per session, so a restart or reconnect keeps
  your changes. _Exit demo_ starts the next one fresh.
