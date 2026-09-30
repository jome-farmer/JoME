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
  than the firmware version. `supports(info, cmd)` in `DeviceContext.ts` does
  this, and screens hide actions the board doesn't have (Wi‑Fi, rain delay,
  restart).
- Messages over **1024 bytes** are refused in the app with `BAD_REQUEST`,
  because the board drops them without answering (protocol §2).
- People see the app's own words for each error `code` (`device/errors.ts`),
  never the board's English `message`. Unknown codes get a generic line.
- `restart()` in `DeviceProvider` sends `device.reboot` and reconnects once the
  board is back. Bluetooth does this through its normal automatic reconnect.

## Zones and valves

The protocol plans separate zones and valves (SHamBE#19). Firmware v1 has fixed
zones `1..zoneCount`, where zone N is valve N. `useGarden` picks the mode from
`hello.cmds` so the screens work the same on both:

| | Board lists `zone.create` | Firmware v1 (fixed zones) |
|---|---|---|
| Zones shown | all | only zones in use: on, or renamed |
| Free valve | not used by any zone | zone that's off and still named `Zone N` |
| Add zone | `zone.create` | `zone.update` that names it and turns it on |
| Delete zone | `zone.delete` | remove it from programs, then turn it off and reset the name |
| Change valve | `zone.update {valve}` | not offered |

## Wi‑Fi

- Firmware v1 sends `wifi.state: connecting` without `ssid`, so the Wi‑Fi
  screen remembers which network it asked to join (SHamBE#21 adds it).
- Failure `reason`s are ESP-IDF codes. `wifiFailureText` says what they mean:
  `AUTH_FAIL` and the handshake timeouts mean a wrong password, and
  `NO_AP_FOUND` means the board can't see the network.
- Serials can be lower case (`shambe-a1b2c3`), so serials and advertised
  names are compared case-insensitively.

## Demo board

`mockLink.ts` simulates a board, with the same commands, events, error codes
and limits as the real one. Keep it in step with the protocol repo when either
changes.

- `createMockLink()` has zones and valves (the planned model). The Demo mode
  uses it. `createMockLink({ valves: false })` behaves like firmware v1, and
  the tests use it for the fixed-zone mode.
- Like the real board: no next run and no rain delay until `time.set`
  (`CLOCK_NOT_SET`), `device.reboot` drops the link, and Wi‑Fi failures use
  ESP-IDF reasons.
- The Demo mode keeps one board per session, so a restart or reconnect keeps
  your changes. *Exit demo* starts the next one fresh.
