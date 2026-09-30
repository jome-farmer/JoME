# ADR 0001 — Cross-platform framework: stay on Capacitor

- **Status:** Proposed
- **Date:** 2026-09-30

## Context

JoME is a phone app that sets up and controls an irrigation controller board.
We release for **iOS and Android**. We need these features:

1. **Bluetooth Low Energy (BLE)** for setup and local control.
2. **USB serial** (a USB‑TTL adapter on the board's UART) as a wired link and a
   serial terminal. It already works on a PC and should work on phones where
   the phone allows it.
3. A premium, easy-to-use UI.
4. A stable, well-supported stack.

The current code is a small React + Vite prototype (about 1k lines, all mock
data) on Capacitor 7. No native projects have been generated yet, so a switch
would cost little. That makes it the right time to decide.

## The hard limits are set by the OS, not by the framework

| Capability | Android | iOS | Desktop (Chrome/Edge) |
|---|---|---|---|
| BLE | ✅ | ✅ | ✅ Web Bluetooth |
| USB‑TTL serial (CH340, CP210x, FTDI, PL2303, CDC‑ACM) | ✅ USB host / OTG | ❌ **Not possible.** iOS only allows USB accessories through Apple's MFi program (External Accessory framework). Common USB‑TTL chips are not MFi. | ✅ Web Serial |

No framework (Flutter, React Native, native Swift) can do USB‑TTL serial on
iOS. **On iPhone the board is reached over BLE.** Because the board uses one
stream protocol for UART and BLE (see [device-protocol.md](../device-protocol.md)),
the serial terminal still works on iPhone, over BLE instead of a cable.

## Options considered

| | Capacitor + React (current) | Flutter | React Native / Expo | Native (Kotlin + Swift) |
|---|---|---|---|---|
| BLE | `@capacitor-community/bluetooth-le`: mature, iOS/Android/Web | `flutter_blue_plus`: mature | `react-native-ble-plx`: mature | Best possible |
| Android USB serial | Small local plugin wrapping `usb-serial-for-android` | `usb_serial` package | Community packages, uneven upkeep | `usb-serial-for-android` directly |
| PC serial terminal, no install | ✅ same build runs in Chrome (Web Serial + Web Bluetooth) | Needs a desktop build | ❌ | ❌ |
| Premium UI | CSS, full control, needs care on motion | Excellent, own renderer | Good | Excellent |
| Rewrite cost | None, only a UI redesign | Full rewrite in Dart | Full UI rewrite | Two codebases |
| Team skills | TypeScript / React (existing) | New language | TypeScript | Two languages |

## Decision

**Keep Capacitor + React + TypeScript + Vite.** Upgrade to the latest stable
Capacitor major during Phase 1 of the [roadmap](../roadmap.md).

- Use `@capacitor-community/bluetooth-le` for BLE. The same API covers
  Android, iOS and the web (Web Bluetooth).
- Write a **small local Capacitor plugin** (Android only, Kotlin) that wraps
  [`usb-serial-for-android`](https://github.com/mik3y/usb-serial-for-android)
  for USB OTG serial. It lives inside `android/` and is not published as a
  package.
- Use the **Web Serial API** for the PC serial terminal. The same web build
  opened in desktop Chrome or Edge becomes the bench tool. We skip Electron.
- **Remove PrimeReact, PrimeIcons and Font Awesome.** Their theme fights the
  new design. We replace them with a small in-house component set built on
  design tokens, plus `lucide-react` for icons.

## Consequences

- iOS users get BLE only. The app hides the USB option on iOS.
- The board must run its own schedules. The app is a remote control and
  configuration tool, not a scheduler, so we don't need background BLE on the
  phone. This removes the main reason to go fully native.
- The premium feel depends on discipline: tokens, 60 fps CSS transitions,
  haptics (`@capacitor/haptics`), native status bar and splash handling.
- **Revisit this decision if** we ever need long-running background BLE, heavy
  real-time charts, or watch or widget extensions. Those push toward native.
