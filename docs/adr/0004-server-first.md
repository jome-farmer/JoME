# ADR 0004 — Server first: reach the board through DouSHamBE

- **Status:** Proposed
- **Date:** 2026-10-01

## Context

Until now the app reached the board only over BLE or USB, so it worked only
within a few metres of the controller. The backend,
[DouSHamBE](https://github.com/jome-farmer/DouSHamBE), now exists:

- Boards connect to it over MQTT once they are on Wi‑Fi. It speaks the same
  protocol v1 messages as BLE and USB.
- It keeps a **cloud copy** of each board's state (hello, status, zones,
  programs, sensors, usage, events). Every part carries its `syncedAt`, and the
  copy is only ever written from the board's own replies.
- It has accounts with passwordless sign-in (phone code, email code, Google),
  and each board belongs to one account (claimed with its label code).

People want to check and control the garden from anywhere, not just from the
garden. We also want to see the garden when the board is offline.

## Decision

1. **The server is the app's main path to a board.** A signed-in app talks to
   its boards through DouSHamBE by default, from anywhere.
2. **BLE and USB are for setup, debugging, and when the phone is nearby.**
   Onboarding (pairing, Wi‑Fi) stays local. The terminal works over any link.
3. **The server is one more `Link`.** `cloudLink` turns request lines into API
   calls and the server's event stream into event lines. `DeviceClient`,
   `useGarden` and every feature work unchanged over it.
4. **Offline reads come from the cloud copy.** When the board is offline, the
   app shows the last copy with its age, and turns off controls that need the
   board.
5. **Sign-in comes before onboarding.** A board is claimed to the account
   right after it joins Wi‑Fi.
6. **The board still runs the schedules.** Neither the app nor the server
   times irrigation.

## Consequences

- The app needs an account and internet for remote use. Without either, BLE
  and USB work as before, and _Try the demo_ needs neither.
- `wifi.scan` and `wifi.set` are never sent through the server (a wrong network
  sent remotely would cut the board off). Wi‑Fi changes need the phone nearby.
- The assistant's device tools (ADR 0002) can run over `cloudLink` like any
  link. The confirmation rule for _act_ tools is unchanged.
- Handing the board its server credentials needs a new local command
  (`server.set`, SHamBE#5) and a protocol PR. Until then, claiming works and
  only a provisioned test board connects to the server.
- Contract: [cloud.md](../cloud.md). Layers and link selection:
  [architecture.md](../architecture.md).
