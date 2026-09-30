# Application architecture

Target structure for the refactor. The framework choice is recorded in
[ADR 0001](adr/0001-cross-platform-framework.md). The device contract is in
[device-protocol.md](device-protocol.md). The AI assistant is covered in
[ADR 0002](adr/0002-ai-assistant.md) and [assistant.md](assistant.md).

## Principles

1. **The board is the source of truth.** The app reads state from the board
   and sends commands. It never runs schedules itself.
2. **Every transport looks the same.** BLE, USB and Mock implement one `Link`
   interface. Features never know which one is in use.
3. **Features own their screens.** A feature folder holds its screens, hooks
   and styles. Shared code moves to `ui/` or `lib/` only after a second feature
   needs it.
4. **Add few dependencies.** Use native platform or browser APIs first. Each
   new package needs a reason in its PR.

## Layers

```
┌───────────────────────────────────────────────┐
│ app/        routes, providers, app shell      │
├───────────────────────────────────────────────┤
│ features/   onboarding · home · zones ·       │
│             schedule · assistant · device ·   │
│             terminal                          │
├──────────────────────┬────────────────────────┤
│ ui/  design system   │ device/ client + links │
├──────────────────────┴────────────────────────┤
│ lib/  storage, formatting, platform, agentApi │
└───────────────────────────────────────────────┘
```

**Dependency rule:** imports only point down. `ui/` never imports from
`device/` or `features/`. Features don't import from each other; shared code
moves down a layer. `device/`'s only React code is `DeviceProvider.tsx` and
the shared data hook `useGarden.ts`.

## Folder layout

```
src/
  main.tsx
  app/
    App.tsx               router (all routes) + providers
    TabLayout.tsx         bottom tab bar shell
    ConnectionBanner.tsx  connecting / lost / demo bar above the tabs
    FirstRunRedirect.tsx  "/" → /welcome when no controller is known
    Splash.tsx            animated launch splash, once per cold start; hides the native splash
    UiGallery.tsx         /ui: living reference of every ui/ component
  ui/                     design system: token-driven, no business logic
    base.css              imports design/tokens.css + bundled fonts
    Screen.tsx  Button.tsx  IconButton.tsx  Card.tsx  Switch.tsx  Sheet.tsx
    Stepper.tsx  ListRow.tsx  StatusPill.tsx  WaterRing.tsx  EmptyState.tsx
  device/
    link.ts               Link interface + LinkKind
    links/
      bleLink.ts          @capacitor-community/bluetooth-le (native + Web Bluetooth); scan / browser chooser
      webSerialLink.ts    desktop Chrome/Edge
      androidUsbLink.ts   bridge to the local UsbSerial Capacitor plugin
      mockLink.ts         simulated board (dev, tests, demo mode)
    lineCodec.ts          bytes → lines; protocol messages vs log lines; 16 KB line cap
    client.ts             DeviceClient: typed request/response + events
    types.ts              Zone, Program, Status… (mirrors device-protocol.md)
    handshake.ts          hello + protocol version check + time.set
    DeviceContext.ts      context type + useDevice()
    DeviceProvider.tsx    owns the one connection: connect / retry / disconnect
    useGarden.ts          live status, zones, programs, running zone + zone/program actions (Home, Zones, Schedule)
  features/
    onboarding/           Welcome → Connect (BLE scan or browser chooser, USB, demo) → Wi‑Fi → Name
    home/                 status hero, quick actions
    zones/                zone list, zone sheet (manual run, edit)
    schedule/             programs list + editor
    assistant/            chat, action cards, tool runner (device tools → DeviceClient)
    device/               device info, link, firmware, rain delay
    terminal/             serial terminal (any link): /device/terminal, 2000-line buffer, baud selector for USB
  lib/
    storage.ts            @capacitor/preferences wrapper (known devices)
    platform.ts           isIOS / isAndroid / hasWebSerial …
    format.ts             durations, times
    agentApi.ts           SSE chat client for the agent backend (fetch + ReadableStream)
android/
  app/src/main/java/.../UsbSerialPlugin.kt   local plugin (usb-serial-for-android)
```

## Device layer

```ts
// device/link.ts
export type LinkKind = 'ble' | 'usb' | 'mock';

export interface Link {
  readonly kind: LinkKind;
  open(): Promise<void>;
  close(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  onData(cb: (bytes: Uint8Array) => void): () => void;   // returns unsubscribe
  onClose(cb: (error?: Error) => void): () => void;
}
```

`DeviceClient` wraps a `Link`:

- `request<T>(cmd, args, timeoutMs?) → Promise<T>` matches responses by `id`.
- `on(evt, cb)` subscribes to events.
- `onLine(cb)` receives every line sent or received (`rx`/`tx`, protocol or log).
  The terminal uses it and can hide protocol lines.
- `writeRaw(text)` lets the terminal send typed input unchanged.

On connect, `DeviceProvider` runs `hello` and then `time.set`, and exposes:

```ts
{ state: 'idle' | 'connecting' | 'ready' | 'lost', info?: Hello, client?: DeviceClient,
  connect(link: Link): Promise<void>, disconnect(): Promise<void> }
```

On an unexpected close it moves to `lost` and the banner offers *Retry*.
`connect` takes a link **factory**, so *Retry* re-creates the same kind of link.
A dropped **BLE** link also reconnects automatically with backoff (1 s, 2 s,
5 s, then every 10 s, `device/backoff.ts`). It only tries while the app is
visible, and a manual disconnect stops it.

On launch the provider reconnects to the most recent known device
(`lib/storage.ts`). Native apps reconnect to BLE devices by their saved
`bleDeviceId`. Browsers can't, because Web Bluetooth needs a tap first. *Exit demo* also forgets the demo device, so the next
launch starts disconnected.

### Which links appear on which platform

| Platform | Links offered in Connect |
|---|---|
| iOS | BLE |
| Android | BLE, USB (only when a USB serial device is attached) |
| Desktop Chrome / Edge | BLE (Web Bluetooth), USB (Web Serial) |
| Other browsers | Demo (mock) only, with a notice |

## State and data

- **Board state:** `useGarden(client)` loads status, zones and programs, follows
  events, and counts the running zone down between board reports. Home and Zones
  use it. Each screen mounts its own copy, so there's no global store yet.
- **App state kept between launches:** known devices
  `{serial, name, lastLink, bleDeviceId?}` in `@capacitor/preferences`.
- **Writes are optimistic** only for toggles and switches. Everything else
  waits for `ok: true`.

## Navigation

```
/welcome → /connect → /setup/wifi → /setup/name          (first run)
/ (tabs)  home · zones · assistant · schedule · device
/device/terminal         full screen, outside the tab layout
```

On launch at `/` with no known controller, `FirstRunRedirect` goes to
`/welcome`. Deep links such as `/ui` are left alone. After that the app opens
on the Home tab and reconnects to the last device. The connect choices live
only on `/connect`; Home and Device link to it.

## Errors

- Link errors turn into a **connection banner** at the top of the tab layout,
  never a modal.
- A command error shows a toast with the board's `message` and a retry
  action when the command is safe to repeat.
- User-facing text follows the copy rules in [design/README.md](../design/README.md#copy).

## Testing

| What | How |
|---|---|
| `lineCodec`, `client` | Vitest unit tests against `mockLink` |
| Feature hooks | Vitest with `mockLink` scripted responses |
| Assistant tool runner | Vitest: tier handling, argument limits, unknown tool rejected, `USER_DECLINED` |
| Screens | Manual, using the in-app **Demo mode** (mock link) |
| Hardware | Manual checklist in [testing-hardware.md](testing-hardware.md) before each release |

## Target dependencies

| Remove | Add |
|---|---|
| `primereact`, `primeicons`, `@fortawesome/*` | `@capacitor/android`, `@capacitor/ios`, `@capacitor-community/bluetooth-le`, `@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor-mlkit/barcode-scanning` (QR), `lucide-react`, `@fontsource-variable/manrope`, `@fontsource/jetbrains-mono` · dev: `vitest`, `prettier` |

Fonts are bundled, not loaded from a CDN, because the app must work with no
internet connection in a garden.
