# Contributing to JoME

Thanks for helping. Please read [docs/architecture.md](docs/architecture.md)
and [design/README.md](design/README.md) before your first PR.

## Setup

Requirements: Node 22 or newer, Xcode 16+ with an iOS simulator runtime (iOS),
Android Studio + JDK 21 (Android).

Supported devices: **iOS 15+** and **Android 7 (API 24)+**, which are Capacitor 8's defaults.

```bash
npm install
npm start               # web dev server
npm run build && npx cap sync
npx cap open android    # or ios
```

With no board at hand, choose **Try the demo** in the app. It uses the
simulated board (`mockLink`). To test real hardware from a computer, open the
dev server in desktop Chrome or Edge. Web Bluetooth and Web Serial work there.

## Workflow: design first

1. **Design.** A change to a screen, the protocol or the architecture starts
   with an update to `design/` or `docs/`. For a large change, open a draft PR
   with only the design and get it approved.
2. **Implement** against the approved design.
3. **Check** with lint, tests, a build, and the relevant items of
   [docs/testing-hardware.md](docs/testing-hardware.md).

## Issues and tasks

Every change starts from a GitHub issue. Issues are grouped into milestones
per [roadmap](docs/roadmap.md) phase and labelled by area (`area:ui`,
`area:device`, `area:assistant`, `area:native`, `area:tooling`). `blocked`
means the issue is waiting on an outside answer.

1. Pick an open issue in the earliest open milestone and assign it to yourself.
2. Create `feature/<issue-number>-<short-slug>` from an up-to-date `develop`,
   for example `feature/9-protocol-core`.
3. Open a PR into `develop` that contains `Closes #<issue-number>`.
4. A maintainer reviews and merges. Authors don't merge their own PRs.

Found something outside the issue's scope? Open a new issue for it.

## Branching (gitflow)

| Branch | From | Merges into | Purpose |
|---|---|---|---|
| `main` | — | — | Released code only. Each merge is tagged `vX.Y.Z`. |
| `develop` | `main` | — | Integration branch for the next release |
| `feature/<issue>-<short-name>` | `develop` | `develop` | New work, e.g. `feature/11-ble-link` |
| `release/<X.Y.Z>` | `develop` | `main` **and** `develop` | Freeze, bump versions, fix bugs only |
| `hotfix/<X.Y.Z>` | `main` | `main` **and** `develop` | Urgent fix to a released version |

- Merge with a PR and `--no-ff`. Never push directly to `main` or `develop`.
- Rebase your feature branch on `develop` before asking for review.
- Delete feature branches after merging.

### Releasing

1. `git checkout -b release/1.2.0 develop`
2. Bump the version everywhere:
   - `package.json` `version`
   - Android `versionName` / `versionCode` (`android/app/build.gradle`)
   - iOS `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (Xcode project)
3. Run the hardware checklist, then open a PR to `main`.
4. After merging, tag `v1.2.0` on `main` and merge `main` back into `develop`.

Versions follow [SemVer](https://semver.org). A change to the device protocol
that breaks old firmware is a **major** bump.

## Commits

[Conventional Commits](https://www.conventionalcommits.org):

```
feat(zones): run a zone from the zone sheet
fix(ble): retry connect after Android GATT 133
docs(protocol): add rain.delay command
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`,
`ci`, `chore`. Scopes are feature or layer names: `onboarding`, `home`,
`zones`, `schedule`, `device`, `terminal`, `ui`, `ble`, `usb`, `protocol`,
`android`, `ios`.

## Pull requests

- Keep each PR to one topic. Aim for under about 400 changed lines.
- The description covers **what** changed and **why**, plus screenshots (light
  and dark) for any UI change and the platforms you tested on.
- CI must pass (lint, test, build).
- Update `docs/` or `design/` when behaviour, protocol or look changes.
- At least one approving review is required.

## Code style

- TypeScript `strict`. Avoid `any`. Validate data where it arrives from the
  board, not deep inside features.
- One component per file, named `PascalCase.tsx`. Hooks go in `useThing.ts`.
  Styles are CSS modules next to the component (`Zone.module.css`).
- Colours, spacing, radius, type and motion come **only** from
  `design/tokens.css` variables.
- CSS logical properties only, so the app stays RTL-ready.
- Follow the layer rule `app → features → ui | device → lib`. Features never
  import from each other.
- Add a dependency only when the platform or a few lines of code can't do the
  job. Explain the choice in the PR.
- Tests: pure logic (codec, client, formatting) gets Vitest unit tests.
  Screens are checked by hand in Demo mode.
- User-facing text follows the copy rules in [design/README.md](design/README.md#copy).

## Reporting bugs

Include:
- the app version (Device tab)
- the phone model and OS version
- the link type (BLE or USB)
- a terminal log if you can capture one (Device → Serial terminal → Copy)
