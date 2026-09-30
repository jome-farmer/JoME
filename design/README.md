# JoME design system

Visual mockups: open [mockups.html](mockups.html) in a browser.
Tokens: [tokens.css](tokens.css) is the only place colours, type, spacing and
motion are defined. The app imports it and never hard-codes values.

## Who and where

The person is a home gardener, a small-farm owner or an installer, standing
**outdoors**, often in bright sun, sometimes with wet or gloved hands. They
open the app to answer three questions:

1. Is my garden being watered as planned?
2. Water this zone now, or stop.
3. Change when things run.

4. What should I do? Ask JoME. The assistant knows plants, weather and this
   garden, and it can act on the system once the user confirms.

Everything else, like Wi‑Fi, firmware and the terminal, is occasional and
lives on the Device tab.

## Principles

1. **Status first.** Each screen opens with the one thing that matters right
   now. On Home that is what is running and what runs next.
2. **Water blue means water is flowing.** `--flow` is used only for active
   watering: the water ring, running zone cards, the flow icon. Seeing blue
   anywhere means a valve is open. Primary actions use `--primary` (leaf green).
3. **Calm and premium.** Off-white ground, one raised hero surface per screen,
   generous spacing, no gradients, no decorative borders. Shadows mark only
   objects you can tap or drag.
4. **Big and forgiving.** Touch targets are at least 48 px. Destructive or
   long-running actions such as *Stop all* and *Rain delay* are one tap and
   can be undone. Nothing hides behind a long-press.
5. **Readable in sunlight.** Body text is at least AA contrast (4.5:1) in both
   themes. Status never relies on colour alone: every state also has an icon
   and a word.
6. **The assistant proposes, the person decides.** Anything the assistant
   would do that starts water or changes the plan appears as an action card
   with a plain summary and *Confirm*. Stopping water is the only action it
   takes by itself. Its answers show their sources.
7. **RTL-ready.** Use CSS logical properties only (`margin-inline-start`,
   `inset-inline-end`). Icons that point a direction flip in RTL. This keeps
   Persian a translation job, not a redesign.

## Foundations

| Token group | Values |
|---|---|
| Colour | Brand: forest, leaf, sprout, mint, water, sun (from the logo). Semantic: `bg`, `surface`, `surface-2`, `line`, `ink`/`ink-2`/`ink-3`, `primary`, `flow`, `warn`, `danger`, `ok` (+ `-soft` fills) |
| Type | **Manrope** for UI (Vazirmatn fallback for Persian). **JetBrains Mono** for the terminal and serial numbers. Scale: 12 / 14 / 16 / 20 / 28 / 40. Durations and times use `tabular-nums`. |
| Space | 4 pt grid: 4, 8, 12, 16, 20, 24, 32. Screen gutter 20. |
| Radius | 10 (inputs, chips), 16 (cards), 24 (sheets, hero), full (pills, round buttons) |
| Motion | 150 ms micro, 250 ms screen/sheet, `--ease`. Off when reduce-motion is set. |
| Dark mode | Follows the system, plus a manual override on the Device tab. Colours are re-tuned for dark, not inverted. |

## Components (`src/ui/`)

Live reference: run the app and open **`/ui`** (also on https://app.jome-farmer.ir/ui) for every component in light and dark.

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (leaf), `secondary` (surface-2), `ghost`, `danger`. Sizes: `md` 48 px, `lg` 56 px. Optional leading icon. Loading state keeps its width. |
| `IconButton` | 44 px round, always has an `aria-label` |
| `Card` | `surface` fill with `--shadow`. Use it only for the hero and tappable items. |
| `ListRow` | Icon, title, optional subtitle, trailing value or chevron. Divided by `--line`. |
| `Switch` | 52×32. Leaf when on. Haptic tick on change. |
| `Stepper` | − value + for durations. Tap and hold repeats. Value in tabular numerals. |
| `StatusPill` | Icon + word, soft fill: `Watering` (flow), `Idle` (surface-2), `Off` (ink-3), `Offline` (danger), `Rain delay` (warn). |
| `WaterRing` | The signature element. A circular progress ring in `--flow` showing time left, with the minutes figure large in its centre. It animates smoothly each second. |
| `Sheet` | Bottom sheet for zone actions and editors. Drag handle, 24 px top radius. |
| `ConnectionBanner` | Slim bar above every tab: `Connecting to …` (warn, pulsing dot), `Connection lost · Retry` or `Couldn't connect … · Retry` (danger), `Demo mode · simulated controller · Exit demo` (neutral). It is never a modal. |
| `TextField` | Label, 48 px input, optional hint or error under it. Focus shows a leaf-green border and a soft ring. Passwords get a show/hide button. The font is 16 px, so iOS doesn't zoom in. |
| `EmptyState` | Illustration (logo mascot), one sentence, one action. |
| `TabBar` | 5 tabs: Home, Zones, **JoME** (assistant, centre, mascot icon), Schedule, Device. Icon and label always shown. The active tab is a leaf-coloured pill. |
| `ChatMessage` | User messages are right-aligned leaf bubbles. Assistant messages are full-width text on the ground, with no bubble, so long answers read like a page. Text streams in. |
| `ActionCard` | The assistant's proposed device action: icon, one-line summary, a detail line (zone, duration, until-time, or before→after for programs), then *Cancel* and *Confirm*. After a decision it collapses to a result line: `Done` (ok), `Declined` (ink-3), or `Failed` + reason (danger). A running action uses `--flow`. |
| `SourceChip` | Small chip under an answer: publisher and title of an agriculture data source. Tapping it opens the details. |
| `ToolTrace` | A quiet single line with a check icon: *Checked zones and programs*. Read tools only. |
| `Composer` | Pill input, 48 px, send button. Suggestion chips appear above it when the chat is empty. |

Icons: `lucide-react`, 1.75 px stroke, 22 px in lists, 24 px in the tab bar.

## Screens

| # | Screen | Purpose and key content |
|---|---|---|
| 1 | **Welcome** | Mascot, "Hi, I'm JoME / your gardener", *Get started*. Shown on first launch only. |
| 2 | **Connect** | Choose how to reach the board: *Scan the label* (primary, phones only; the app finds that board, shows its pairing code large, and checks the serial after connecting), list of nearby `JoME-XXXX` devices with signal strength, *Use USB cable* (Android and desktop only), *Try demo*. Pairing uses the **system** dialog. When the passkey is known from the QR code, the app shows it large so it's easy to type. |
| 3 | **Wi‑Fi** | Networks come from the board's own scan (`wifi.scan`), with signal bars and a lock icon. Password field. Live status: connecting, connected (IP), or failed with a reason. *Skip for now* is allowed. |
| 4 | **Name** | Name the garden (up to 32 characters, stored on the board with `device.rename`). *Start gardening* lands on Home. |
| 5 | **Home** | Header: greeting, garden name, link pill. **Hero**, one of four states: *Watering* (WaterRing, zone name, "Zone 3 · Evening program" or "Started by hand", **Stop watering**); *Rain delay* (paused until when, change or cancel); *Idle* (next watering and in how long); *Nothing scheduled* (create a program). Quick actions: *Run a zone* (→ Zones), *Rain delay* (sheet: 24, 48 or 72 h, or cancel), *Stop all* (only while watering). **Today** timeline: today's enabled programs marked done, now or upcoming. The node is water blue only while that program is actually watering. |
| 6 | **Zones** | Summary line "1 running · 2 idle · 1 off". Zone cards: **valve number**, name, state pill, default duration, big round **Run** button. A running card fills with a water-level tint. **Add zone** at the end. Zone sheet: run time stepper and Run, make it the default, zone on/off, rename, **change valve**, **delete zone** (inline confirm: *Delete Front lawn? Programs stop watering it.*). |
| 6b | **Add a zone** | Sheet: name, **valve picker** (a grid of the controller's valves: free ones selectable, taken ones greyed with their zone's name), default run time, *Add zone*. With no zones yet, the Zones screen is an empty state: *Each zone is one valve on the controller. Add your first zone.* Onboarding doesn't ask for zones; people add them from the Zones tab after setup. |
| 7 | **Assistant — start** | Mascot greeting with one live insight from the agent (for example, tonight's rain forecast). Context chip showing which garden it's looking at. Four suggestion chips. Composer. Offline state: *The assistant needs internet. Your garden keeps running on schedule.* |
| 8 | **Assistant — chat** | The conversation. Tool traces, source chips and action cards appear in the flow, in the order they happened. A header menu has *New chat*. |
| 9 | **Schedule** | Programs as cards, sorted by start time: name, **start time** (largest), 7 day chips, the zones in order and the total (*Front lawn → Hedge · 35 min*), and an on/off switch (optimistic; paused cards are dimmed). **+** opens the editor. The editor (`/schedule/new`, `/schedule/:id`) is full screen: name, day chips, the native time picker, and numbered zone steps, each with a zone, a run time (1–60 min), and move up/down or remove. *Add a zone* (up to 16 steps). Save checks for problems and explains them in plain words. Delete asks to confirm first. |
| 10 | **Device** | Controller card: name, serial in mono, firmware, and zones out of the valve count. Rows: **Wi‑Fi** (current network, which opens the Wi‑Fi screen in settings mode at `/device/wifi` with *Done* instead of the setup steps), **Rain delay** (Off, or *Until Friday 18:17*; the same sheet as Home), **Appearance** (*Match phone*, *Light* or *Dark*; saved on the phone, applied on launch, and status-bar icons follow it), **Serial terminal**. Then *Connection*, *Disconnect* (or *Exit demo*), and **Forget this device**, which asks to confirm first and explains that zones and programs stay on the controller. |
| 11 | **Terminal** | Opens from Device, full screen with no tab bar. The console is dark in both themes. On open it shows the link and controller details, then points to `help`. The input accepts short commands such as `status` and `run 2 10m`; `status` prints the Wi-Fi state, network name and IP when available, while invalid commands stay local and explain their syntax. Firmware logs are plain, board protocol lines are mint (←), and lines the app sends are **amber** (→); blue is reserved for water. Chips: link (Bluetooth, USB with a baud selector, or Demo), *Protocol* and *Timestamps* toggles, *Clear*. Copy is in the header. It follows new output unless you scroll up, and keeps the last 2,000 lines. |

## Motion: launch splash

Prototype: [splash.html](splash.html). It plays once per cold start and lasts about 1.6 s.

| Time | What happens |
|---|---|
| 0.00 s | Handoff from the static native launch screen (iOS only allows a static one). The logo sits in the same spot, so there's no jump. |
| 0.08 s | The eyes blink awake. |
| 0.22 s | A water drop falls onto the leaf. |
| 0.56 s | It lands: the sprout bounces, and two `--flow` ripples spread out. |
| 0.62 s | The wordmark draws itself, letter by letter (its letters are strokes). |
| 1.30 s | Zoom through and fade into the app. |

- It uses the real logo SVG. Existing parts are only grouped so they can move; no shape is changed.
- It never delays the app: it runs for a fixed time while the app loads underneath.
- With reduced motion on, nothing moves: the logo holds for 0.4 s and fades out.
- In dark mode the wordmark's green letters switch to `--ink` so they stay readable. The "o" stays water blue.

## Flows

```
First run:  Welcome → Connect ─┬─ QR → pair (passkey shown) ───┐
                               ├─ pick device → system pairing ─┼→ Wi‑Fi → Name → Home
                               ├─ USB (Android/desktop) ────────┘
                               └─ Try demo → Home (mock board, "Demo mode" banner with Exit demo)
Returning:  launch → Home (auto-reconnect to last device; banner while reconnecting)
```

## Copy

- Say what happens: *Run 10 min*, *Stop watering*, *Delay 24 h*. Avoid *Submit* and *OK*.
- Use the gardener's words: *zone*, *program*, *rain delay*, *watering*. Never
  *valve index*, *GPIO* or *payload*.
- Errors say what went wrong and what to do: *Couldn't reach JoME‑0001. Move
  closer and tap Retry.*
- Show durations as `7 min`, `1 h 20 min`. Show times in the phone's 12 h or 24 h setting.

## Out of scope for 1.0

User accounts and the Profile screen (unless the assistant needs accounts; see
the roadmap), water-usage analytics, soil moisture charts, assistant voice
input and photo diagnosis. Each waits on a data source or an answer from the
agent team.
