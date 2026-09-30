<p align="center">
  <img src="docs/logo/horizontal.svg" alt="JoME" width="360" />
</p>

<p align="center"><b>Your garden, watered on time.</b></p>

JoME is a smart irrigation controller for home gardens, urban gardens and
greenhouses. This repository contains the **JoME app** for iOS and Android.
Use it to set up the controller, run and stop zones, manage watering programs,
and ask the **JoME AI assistant** what your garden needs.

## Features

- **Set up in a minute.** Scan the QR code on the controller, pair over
  Bluetooth, and put it on Wi‑Fi.
- **Live status.** See which zone is watering, how long is left, and what runs next.
- **Zones.** Run, stop, rename or disable up to 16 zones.
- **Programs.** Weekly schedules that run **on the controller**, so the garden
  keeps being watered when your phone is off.
- **Rain delay.** Pause all programs for a set number of hours.
- **AI assistant.** A chat assistant backed by fine-tuned agriculture models
  and data sources (weather, crops, soil). It can act on your system, but
  nothing that starts water or changes a program runs until you tap *Confirm*.
- **Serial terminal.** Firmware logs and a command line over USB or Bluetooth,
  for installers and developers.
- **Demo mode.** Try every screen with a simulated controller.

## Platforms and connections

|  | Bluetooth | USB cable (USB‑TTL) |
|---|---|---|
| Android | ✅ | ✅ over USB OTG |
| iOS | ✅ | ❌ iOS doesn't allow it ([why](docs/adr/0001-cross-platform-framework.md)) |
| Desktop Chrome / Edge | ✅ Web Bluetooth | ✅ Web Serial |

## Status

🚧 **The app is being rebuilt.** The design phase is done: see the
[screen mockups](design/mockups.html) and the [roadmap](docs/roadmap.md).
The code in `src/` is the old prototype and is being replaced phase by phase.

## Tech stack

[Capacitor](https://capacitorjs.com) · React 19 · TypeScript · Vite ·
`@capacitor-community/bluetooth-le` · Web Serial / Android USB serial ·
Vitest. The framework choice is explained in
[ADR 0001](docs/adr/0001-cross-platform-framework.md).

## Getting started

Requirements: Node 20+, and Xcode (iOS) or Android Studio + JDK 17 (Android).

```bash
npm install
npm start                 # web dev server. Open in desktop Chrome for Bluetooth/USB
```

Run on a phone:

```bash
npm run build
npx cap sync
npx cap open android      # or: npx cap open ios
```

Other commands: `npm run lint`, `npm test`.

## Documentation

| | |
|---|---|
| [Architecture](docs/architecture.md) | Layers, folders, device layer, state |
| [Device protocol](docs/device-protocol.md) | How the app talks to the controller (BLE and USB) |
| [AI assistant](docs/assistant.md) | How the app talks to the JoME agent, and its safety rules |
| [Design system](design/README.md) | Principles, tokens, components, screens |
| [Roadmap](docs/roadmap.md) | Phases and open questions |
| [Decisions (ADRs)](docs/adr/) | Why things are the way they are |

## Contributing

We use gitflow (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`),
Conventional Commits, and design-first changes. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
