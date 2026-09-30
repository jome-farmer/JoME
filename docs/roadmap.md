# Refactor roadmap

We design first, then implement. Each phase is one or more `feature/*`
branches merged into `develop`.

## Phase 0 — Design ✅ (this branch)

- Framework decision ([ADR 0001](adr/0001-cross-platform-framework.md))
- [Architecture](architecture.md) and [device protocol](device-protocol.md)
- [Design system and screens](../design/README.md), [mockups](../design/mockups.html)
- `CLAUDE.md`, `CONTRIBUTING.md`, gitflow branches

**Exit:** the team signs off on the design and on the open questions below.

## Phase 1 — Foundation

- Upgrade to Capacitor 8, add `android/` and `ios/` projects, with `appId` `ir.jomefarmer.jome`
- Remove PrimeReact, PrimeIcons and Font Awesome. Add the `ui/` components from
  the design system.
- Set up the app shell: routes, tab layout, `DeviceProvider`, `mockLink`, Demo mode
- Add Vitest and Prettier, plus a CI workflow running lint, test and build on PRs to `develop`

## Phase 2 — Device link

- `lineCodec` + `DeviceClient` with unit tests
- `bleLink` (native + Web Bluetooth)
- `webSerialLink` (desktop)
- Android `UsbSerialPlugin` + `androidUsbLink`
- Terminal feature

## Phase 3 — Screens

- Onboarding: Welcome → Connect (BLE list, QR, USB) → Wi‑Fi → Name
- Home, Zones (+ zone sheet), Schedule (+ program editor), Device

## Phase 3b — AI assistant

- `agentApi` (SSE) + tool runner with safety tiers ([ADR 0002](adr/0002-ai-assistant.md))
- Assistant tab: start screen, chat, action cards, sources, consent sheet
- Needs: agent API details and an auth decision (questions 4 and 5 below)

## Phase 4 — Polish and release 1.0.0

- Haptics, status bar, splash, app icons from `public/logo`
- Dark mode check, accessibility pass (contrast, touch targets, screen reader labels)
- [Hardware checklist](testing-hardware.md), then `release/1.0.0`

## Open questions (need answers before Phase 1)

1. ~~**App ID.**~~ Resolved: `ir.jomefarmer.jome` ([ADR 0003](adr/0003-app-id.md)).
2. **Languages.** Is Persian (RTL) needed for 1.0? The CSS is RTL-ready either way.
3. **Board MCU and firmware owner.** Is it ESP32? Who implements the protocol on
   the firmware side?
4. **Cloud and accounts.** The assistant needs an authenticated call to the agent
   backend. Do we add JoME accounts, or use per-device tokens? Remote control over
   the internet depends on the same answer.
5. **Agent API.** See the open questions in [assistant.md](assistant.md#open-questions-for-the-agent-team).
6. ~~**Minimum OS versions.**~~ Resolved: iOS 15+ and Android 7 (API 24)+, Capacitor 8's defaults.
