# CLAUDE.md

JoME is a phone app for the JoME smart irrigation controller. It sets up the
board (BLE pairing, Wi‑Fi) and controls it (zones, programs, rain delay). It
also includes a serial terminal and an **AI assistant** (the JoME agent backend,
with fine-tuned agriculture models) that can control the system through tools. Built with **Capacitor + React 19 +
TypeScript + Vite** for iOS and Android. The same web build doubles as a
desktop bench tool in Chrome.

## Current state

- **Phase 0 (design) is done.** Implementation follows [docs/roadmap.md](docs/roadmap.md).
- `src/` is still the old prototype (PrimeReact, mock data). Don't extend it.
  Replace it screen by screen with the target architecture.
- Open questions that block Phase 1 are listed at the end of the roadmap.

## Read before changing things

| Topic | Source of truth |
|---|---|
| Why Capacitor, what's possible on each platform | [docs/adr/0001-cross-platform-framework.md](docs/adr/0001-cross-platform-framework.md) |
| Folders, layers, device layer, state | [docs/architecture.md](docs/architecture.md) |
| App ↔ board protocol (BLE NUS, USB serial, JSON lines) | [docs/device-protocol.md](docs/device-protocol.md) |
| AI assistant: agent contract, device tools, safety tiers | [docs/adr/0002-ai-assistant.md](docs/adr/0002-ai-assistant.md), [docs/assistant.md](docs/assistant.md) |
| Design principles, components, screens, copy | [design/README.md](design/README.md), [design/mockups.html](design/mockups.html) |
| Colours, type, spacing, motion | [design/tokens.css](design/tokens.css) (never hard-code these) |
| Branching, commits, PRs | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Rules that are easy to get wrong

- **Design first, then implement.** Update `design/` or `docs/` in the same PR
  as any change that alters a screen, the protocol or the architecture.
- **iOS has no USB serial.** It is an OS limit (MFi), not a bug. On iOS the
  board is reached over BLE only. Hide USB options there.
- **The assistant never opens a valve without a tap.** Agent tool calls that start
  water or change zones or programs need a confirmed action card. The app checks
  tier and limits in `features/assistant`, never in the prompt. Only read and
  stop tools run automatically.
- **The board runs the schedules.** The app never times irrigation itself.
- **Water blue (`--flow`) means water is flowing.** Don't use it for anything else.
- **Use CSS logical properties only** (`margin-inline-start`, not `margin-left`).
  The app must stay RTL-ready for Persian.
- Features talk to hardware only through `DeviceClient`. They never touch a
  `Link` or a Capacitor plugin directly.
- Imports point down the layers: `app → features → ui | device → lib`. Features
  never import from other features.
- No PrimeReact, Font Awesome, or UI kits. Use `src/ui/` components with
  `lucide-react` icons.
- Fonts and assets are bundled. The app must work offline.

## Commands

```bash
npm start            # dev server (web). Use Demo mode or desktop Chrome for BLE/USB
npm run build        # type-check + production build to dist/
npm run lint
npm test             # vitest (from Phase 1)
npx cap sync         # copy web build + plugins into native projects
npx cap open ios     # / android
```

## Git

Gitflow: `main` (releases, tagged), `develop` (integration), `feature/*`,
`release/*`, `hotfix/*`. Branch features off `develop`. Use Conventional
Commits. Never commit directly to `main` or `develop`.
