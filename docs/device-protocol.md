# Device protocol

**The contract lives in [jome-farmer/protocol](https://github.com/jome-farmer/protocol)**
(`protocol.md`). It is shared by the app, the board firmware (SHamBE) and the
server (DouSHamBE), and it covers transports, the message format, every
command, events, types, error codes, limits, the QR label, and the rules for
changing any of them. Read it before touching `src/device/`.

To change the protocol, open a PR there first and link it to the matching
firmware and app PRs. `src/device/types.ts` mirrors its types.

This page only covers how the app implements it.

## Links

Every transport is a `Link` (`src/device/link.ts`), a byte stream with the
same interface. Features never touch a link directly. They go through
`DeviceClient`.

| Link                | File                      | Platforms                     |
| ------------------- | ------------------------- | ----------------------------- |
| BLE (Nordic UART)   | `links/bleLink.ts`        | Android, iOS, desktop Chrome  |
| USB serial, Android | `links/androidUsbLink.ts` | Android (OTG)                 |
| USB serial, Web     | `links/webSerialLink.ts`  | desktop Chrome/Edge           |
| Demo board          | `links/mockLink.ts`       | everywhere (Demo mode, tests) |

- **iOS has no USB serial** (MFi). Hide USB options there.
- **BLE writes** are split into `MTU − 3` byte chunks. Android requests the
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
  times requests out (5 s, `wifi.scan` 15 s).
- `handshake.ts` runs on every connect: `hello` (refuses other `proto`), then
  `time.set` with the phone's clock and IANA zone.
- Feature-detect with `hello.cmds` (optional: older boards omit it) rather
  than the firmware version.

## Demo board

`mockLink.ts` simulates a board, with the same commands, events, error codes
and limits as the real one. Keep it in step with the protocol repo when either
changes.
