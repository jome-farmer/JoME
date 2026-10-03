# JoME design system

Visual mockups: **[redesign-2026-10.png](redesign-2026-10.png)** is the current look
(Home, Map, Zone detail, Schedule, Devices, Analytics; issue #135). Screens it
doesn't show (onboarding, sign-in, assistant, terminal, Device settings) are
still in [mockups.html](mockups.html) and take the new tokens.
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
lives under **More**.

## Principles

1. **Status first.** Each screen opens with the one thing that matters right
   now. On Home that is what is running and what runs next.
2. **Water blue means water is flowing.** `--flow` is used only for active
   watering: the water ring, running zone cards, the flow icon. Seeing blue
   anywhere means a valve is open. Primary actions use `--primary` (leaf green).
3. **Calm and premium.** Pale sage ground, deep pine (`--primary`) for the
   chosen action, tab and segment, big soft cards (20 px radius), generous
   spacing. Home and Zone detail open on a picture of the garden (bundled
   illustrations in `public/art/`, dimmed by `--art-filter` in dark mode);
   readings laid over a picture sit on glass tiles (`--scrim`). No decorative
   borders.
3b. **Sample data says so.** Soil moisture, EC, pH, sensors, the nutrient
   doser, rules, and the area of a zone not yet drawn on the map have no data
   source yet. They come
   from `src/services/field.ts` and are always labelled *Sample*. Nothing
   sampled is ever a control: rules show *On*/*Off* as words, not switches.
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
| Motion | 150 ms micro, 250 ms screen/sheet, `--ease`. Screens fade in; sheets slide up to open and down to close. Off when reduce-motion is set. |
| Haptics | Light tick when a switch changes. A firmer tap when water starts or stops, and on a confirmed change (Confirm, Delete, Restart, Forget). Nothing else buzzes. |
| Contrast & touch | Text meets WCAG AA (4.5:1) on `bg`, `surface` and `surface-2` in both themes, `ink-3` included. Status colours (`flow`, `warn`, `danger`) are the text-safe shades; the logo's `--water` is for brand art only. Every control has a 48 px (`--tap`) touch area: a small one keeps its look and gets an invisible `data-tap` area around it. |
| Dark mode | Follows the system, plus a manual override in Controller settings. Colours are re-tuned for dark, not inverted. |

## Components (`src/ui/`)

Live reference: run the app and open **`/ui`** (also on https://app.jome-farmer.ir/ui) for every component in light and dark.

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (leaf), `secondary` (surface-2), `ghost`, `danger`. Sizes: `md` 48 px, `lg` 56 px. Optional leading icon. Loading state keeps its width. `haptic` for run/stop and confirmed changes. |
| `IconButton` | 44 px round, 48 px touch area (`data-tap`), always has an `aria-label` |
| `Card` | `surface` fill with `--shadow`. Use it only for the hero and tappable items. |
| `ListRow` | Icon, title, optional subtitle, trailing value or chevron. Divided by `--line`. |
| `Switch` | 52×32, 48 px touch area (`data-tap`). Leaf when on. Haptic tick on change. |
| `Stepper` | − value + for durations. Tap and hold repeats. Value in tabular numerals. |
| `StatusPill` | Icon + word, soft fill: `Watering` (flow), `Idle` (surface-2), `Off` (ink-3), `Offline` (danger), `Rain delay` (warn). |
| `WaterRing` | The signature element. A circular progress ring in `--flow` showing time left, with the minutes figure large in its centre. It animates smoothly each second. |
| `Sheet` | Bottom sheet for zone actions and editors. Drag handle, 24 px top radius. |
| `ConnectionBanner` | Slim bar above every tab: `Connecting to …` (warn, pulsing dot), `Connection lost · Retry` or `Couldn't connect … · Retry` (danger), `Demo mode · simulated controller · Exit demo` (neutral). It is never a modal. |
| `TextField` | Label, 48 px input, optional hint or error under it. Focus shows a leaf-green border and a soft ring. Passwords get a show/hide button. The font is 16 px, so iOS doesn't zoom in. |
| `EmptyState` | Illustration (logo mascot), one sentence, one action. |
| `TabBar` | 5 tabs: Home, Zones, Map, Schedule, More. Icon and label always shown. The active tab is a mint pill with a pine icon. Screens opened from More (assistant, Device, Devices, Analytics) keep More lit. |
| `Segmented` | A row of pills on a white track that picks one view (*Map · Zones · Sensors*). The chosen one is filled pine. |
| `BarChart`, `Sparkline`, `Donut` | `src/ui/Chart.tsx`. Bars are mint with today in pine; donut slices use `--chart-1…6`. None of them is ever blue. |
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
| 1b | **Sign in** | **For now Google only** (`VITE_CODE_SIGNIN` off: no phone field, *Send code* or *Use email instead*; *Continue with Google* is the primary button, and `/signin/code` goes back here). The rest of this row and 1c are the code sign-in, switched on with `VITE_CODE_SIGNIN=true` once the server can send SMS and email. After Welcome, before Connect. *Sign in to JoME* / *Check on your garden from anywhere.* Phone number field (prefix *+98*, the user types *0912…* or *912…*), *Send code* (primary). *Continue with Google* (secondary, Google mark). *Use email instead* switches the field. One screen for new and returning people: no separate sign-up. *Try the demo* stays available below and needs no account. Errors in words: *That number doesn't look right. Use an Iranian mobile, like 0912 345 6789.* |
| 1c | **Code** | *Enter the code* / *We sent it to 0912 345 6789.* Six boxes, number keypad, filled from the SMS automatically where the phone allows it, and checked as soon as the sixth digit is typed. *Resend code* counts down from 60 s. *Change number* goes back. Wrong code: *That code didn't work. Check it or ask for a new one.* After 5 tries, *Ask for a new code.* A new account goes on to Connect; a returning one goes to Home. |
| 2 | **Connect** | Choose how to reach the board: *Scan the label* (primary, phones only; the app finds that board, shows its pairing code large, and checks the serial after connecting), list of nearby `JoME-XXXX` devices with signal strength, *Use USB cable* (Android and desktop only), *Try demo*. Pairing uses the **system** dialog. When the PIN is known from the QR code, the app shows it large so it's easy to type. The label QR is a web link, so scanning it with the phone's own camera opens the app on this screen with the board already chosen (same as *Scan the label*); without the app it opens the store page. |
| 3 | **Wi‑Fi** | Networks come from the board's own scan (`wifi.scan`), with signal bars and a lock icon. Password field. Live status: connecting, connected (IP), or failed with a reason. *Skip for now* is allowed. |
| 3b | **Claim** | After Wi‑Fi. Adds the board to the account, so it can be reached from anywhere. With the QR label scanned, it's automatic: a short *Adding JoME‑0001 to your account…* step. Otherwise it asks for the 6‑digit code printed on the label. Errors: *That code doesn't match this JoME. Check the label.*; *This JoME belongs to another account. Ask its owner to remove it first.* *Skip for now* is allowed: the board then works only nearby. **Then the board registers itself:** *Connecting JoME‑0001* with a live pill that follows the board (*Registering with JoME's server…*, *Registered. Connecting…*, *Connected*), the app having handed it a one-time token over Bluetooth or USB. A failure says why in words (*The setup code expired or was already used. Try again to get a new one.*) with *Try again* and *Skip for now*. A development board (no factory label code) says *JoME‑a1b2 is a development board… It can't be added to an account* and goes on with *Continue*. |
| 4 | **Name** | Name the garden (up to 32 characters, stored on the board with `device.rename`). *Start gardening* lands on Home. |
| 5 | **Home** | **Picture hero** (garden illustration under the sky): greeting, garden name, link and temperature pills, the mascot button that opens the assistant, and three glass tiles *Soil moisture · EC · pH* with their level in words (sample). Under it the status card: when idle with a next run it's *Next irrigation · Tomorrow 18:00 · Evening · in 19 h* with an *Auto* pill, opening Schedule. **Water used (7 days)** is a bar chart, today in pine, opening Analytics; only on boards that list `usage.read`. The **board temperature** pill (*28.5 °C*, thermometer icon, neutral pill; *— °C* when the sensor has no reading), only on boards that list `sensors.read`. It's read on open and every minute. The **status card** is one of four states: *Watering* (WaterRing, zone name, "Zone 3 · Evening program" or "Started by hand", the **live flow** from the board's flow sensor, *12.4 L/min*, water blue only while it's above 0, **Stop watering**); *Rain delay* (paused until when, change or cancel); *Idle* (next watering and in how long); *Nothing scheduled* (create a program). Quick actions: *Run a zone* (→ Zones), *Rain delay* (sheet: 24, 48 or 72 h, or cancel), *Stop all* (only while watering). **Weather** (Open-Meteo) at the garden: now (icon, temperature, sky in words, today's high/low and rain chance) and the next 5 days (day, icon, high/low, rain %). Icons stay neutral: rain is never water blue. The place is this phone's position, asked only when the user taps *Use this phone's location* (the card says it's saved on this phone and sent rounded to about 1 km); *Update location* re-takes it. Denied: how to allow it in settings. Offline or failed: *Couldn't get the weather. It needs internet; your garden keeps running on schedule.* **Today** timeline: today's enabled programs marked done, now or upcoming. The node is water blue only while that program is actually watering. |
| 6 | **Zones** | Tapping a zone card opens **Zone detail**. Summary line "1 running · 2 idle · 1 off". Zone cards: **valve number**, name, state pill, default duration, big round **Run** button. A running card fills with a water-level tint and shows the live flow next to the time left (*6:42 left · 12.4 L/min*). **Add zone** at the end. Zone sheet: run time stepper and Run, make it the default, zone on/off, rename, **change valve**, **delete zone** (inline confirm: *Delete Front lawn? Programs stop watering it.*). |
| 6c | **Zone detail** | `/zones/:zone`. Back arrow, name, *Valve 3 · 250 m²* (measured from its map outline, or a sample until one is drawn), state pill (*Watering* in flow blue, *Active*, *Off*). A crop picture, then *Overview · Sensors · Schedule · Settings*. Overview: **Live status** (watering with time left, percent and a flow-blue progress bar; or idle/off), three sample reading tiles, **Today** (water used and watering time from `usage.read`, default run), **Run now** / **Stop**, and **On schedule** (the zone's on/off). Sensors: sample readings with sparklines. Schedule: programs that water this zone. Settings: opens the zone sheet (rename, valve, run time, delete), and *Outline on the map*. |
| 6d | **Map** | Tab. Garden name, zone count, temperature pill. *Map · Zones · Sensors*. Map: a real map (Leaflet), **satellite by default** (Esri World Imagery) with a layers button for the **OpenStreetMap** street map, and a target button that goes to this phone's location. It opens on the zones' outlines, or else the garden's saved place (the Weather card's), or else Iran. Each zone with an outline is drawn on it: green, sun for low moisture (sample), grey when off, water blue only while that zone waters, with a glass chip (name, then *Watering · 6 min left*, *Off* or *Soil 68%*). Tapping a zone opens Zone detail. **Draw zone outlines · 3 to go** (or *Edit zone outlines*) opens a bar under the map: pick the zone, tap its corners on the map in order (dashed outline, white corner dots), *Undo*, *Cancel*, *Save* (3 corners or more), *Remove this outline*. Zone detail › Settings › *Outline on the map* lands here drawing that zone. Outlines are kept on this phone (`lib/storage`, per controller) until DouSHamBE stores them; their area replaces the sample m² on Zone detail and in Analytics. Tiles need internet: offline the map says *The map needs internet. Your garden keeps running on schedule.* and the zone list still works. Under the map: the running zone with *Stop* (the board has no pause), or the next run. Zones: a compact list. Sensors: sample sensors. |
| 6b | **Add a zone** | Sheet: name, **valve picker** (a grid of the controller's valves: free ones selectable, taken ones greyed with their zone's name), default run time, *Add zone*. With no zones yet, the Zones screen is an empty state: *Each zone is one valve on the controller. Add your first zone.* Onboarding doesn't ask for zones; people add them from the Zones tab after setup. |
| 7 | **Assistant — start** | Mascot greeting with one live insight from the agent (for example, tonight's rain forecast). Context chip showing which garden it's looking at. Four suggestion chips. Composer. Offline state: *The assistant needs internet. Your garden keeps running on schedule.* |
| 8 | **Assistant — chat** | The conversation. Tool traces, source chips and action cards appear in the flow, in the order they happened. A header menu has *New chat*. |
| 9 | **Schedule** | *Irrigation and nutrient plans*, round pine **+**. *Irrigation · Nutrients · Rules*. Irrigation: a Monday-to-Sunday strip (today picked), then that day's plan, one row per zone step: start time, zone, program and minutes, and a state badge (done ✓ in pine, now ▶ in flow blue, upcoming ring, paused − dimmed). A row opens its program. *Add schedule*, then the **Programs** list. Nutrients and Rules are samples. Programs as cards, sorted by start time: name, **start time** (largest), 7 day chips, the zones in order and the total (*Front lawn → Hedge · 35 min*), and an on/off switch (optimistic; paused cards are dimmed). **+** opens the editor. The editor (`/schedule/new`, `/schedule/:id`) is full screen: name, day chips, the native time picker, and numbered zone steps, each with a zone, a run time (1–60 min), and move up/down or remove. *Add a zone* (up to 16 steps). Save checks for problems and explains them in plain words. Delete asks to confirm first. |
| 10 | **Device** | Now *Controller settings*, opened from More, with a back arrow. Controller card: name, serial in mono, firmware, and zones out of the valve count. **Connection** row: *Through the internet* (cloud) or *Bluetooth nearby* / *USB*, with *Connect nearby* to switch (needed to change Wi‑Fi). **Account** row: phone or email, *Sign out*. **JoME's server** row (not on the demo): through the internet it says *Online* or *Offline*; over Bluetooth or USB it shows the board's last `server.state` (*Registering…*, *Registered*, *Connecting…*, *Online*, or *Needs attention* with the reason in words underneath), or *Not reported* until the board says something. Tapping it opens a sheet with the sentence and, when signed in on a nearby link, *Connect to the server* or *Connect again* (a new one-time token; the same steps as onboarding). *Connect again* is the answer to a certificate the server no longer accepts and to a board the server removed. Rows: **Wi‑Fi** (current network, which opens the Wi‑Fi screen in settings mode at `/device/wifi` with *Done* instead of the setup steps), **Rain delay** (Off, or *Until Friday 18:17*; the same sheet as Home), **Appearance** (*Match phone*, *Light* or *Dark*; saved on the phone, applied on launch, and status-bar icons follow it), **Serial terminal**. Then *Connection*, *Disconnect* (or *Exit demo*), and **Forget this device**, which asks to confirm first and explains that zones and programs stay on the controller. |
| 13 | **More** | Tab. *Ask JoME*, *Analytics*, *Devices*; then *Controller settings* and *Serial terminal*. |
| 14 | **Devices** | `/devices`, back arrow. *All · Controllers · Sensors · Valves*. The controller (online/offline, opens Controller settings), sample sensors and equipment with sparklines, and each valve with its zone (*Open* in flow blue while watering). |
| 11 | **Terminal** | Opens from Device, full screen with no tab bar. The console is dark in both themes. On open it shows the link and controller details, then points to `help`. The input accepts short commands such as `status`, `zones` and `run 2 10m`; `status` prints the Wi-Fi state, network name and IP when available, and `zones` prints each zone's name, state and default time. Invalid commands stay local and explain their syntax. Firmware logs are plain, board protocol lines are mint (←), and lines the app sends are **amber** (→); blue is reserved for water. Chips: link (Bluetooth, USB with a baud selector, or Demo), *Protocol* and *Timestamps* toggles, *Clear*. Copy is in the header. It follows new output unless you scroll up, and keeps the last 2,000 lines. |
| 12 | **Analytics** | Replaces Water use (`/usage` redirects to `/analytics`). From More or the Home card, with a back arrow and a *Last 7 / 30 / 90 days* picker. *Water · Soil · Nutrients · Weather*. Water: total with *↓ 12%* against the period before (7 and 30 days only: the board keeps 90), a bar per day, **Use by zone** as a donut with shares, and **Efficiency** in L/m² (zone areas are a sample). Soil, Nutrients and Weather are sample charts. Days with nothing logged are empty bars; weekday names under 7 days, first date and *Today* otherwise. A zone that no longer exists shows as *Zone 4 (removed)*. Bars are green, never water blue: this is past use, not water flowing now. Data is the controller's own 90-day log (`usage.read`), so it includes runs when no phone was connected. Empty: *No water logged yet*, with how logging works. |

## Board offline

When the server is reachable but the board isn't, every tab shows the cloud
copy instead of a blank screen:

- The connection banner reads *Backyard is offline · Last synced 12 min ago*
  in neutral colours. It's never water blue or red: the garden keeps running on
  its schedule.
- Values that came from the copy are shown as they were, never as live.
  Watering shows only if the board was watering at the last sync, as *Was
  watering Front lawn at 18:02*, with no countdown.
- Controls that need the board (Run, Stop, edits, rain delay) are disabled. A
  tap explains why: *Changes need Backyard online. It reconnects on its own when
  its Wi‑Fi is back.*
- Pull to refresh asks the server to re-read the board; offline it says so.

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
First run:  Welcome ─┬─ Sign in → Code → Connect ─┬─ QR → pair (passkey shown) ───┐
                    │                            ├─ pick device → system pairing ─┼→ Wi‑Fi → Claim → Name → Home
                    │                            └─ USB (Android/desktop) ────────┘
                    └─ Try demo → Home (mock board, "Demo mode" banner with Exit demo)
Returning:  launch → Home (through the internet by default; nearby BLE when the board is offline
            and the phone is near it; banner while reconnecting)
Signed in on a new phone:  Sign in → Code → Home (the account's boards, no setup)
```

## Copy

- Say what happens: *Run 10 min*, *Stop watering*, *Delay 24 h*. Avoid *Submit* and *OK*.
- Use the gardener's words: *zone*, *program*, *rain delay*, *watering*. Never
  *valve index*, *GPIO* or *payload*.
- Errors say what went wrong and what to do: *Couldn't reach JoME‑0001. Move
  closer and tap Retry.*
- Show durations as `7 min`, `1 h 20 min`. Show times in the phone's 12 h or 24 h setting.

## Out of scope for 1.0

A Profile screen beyond *Sign out* (accounts themselves arrive in Phase 5),
real soil, nutrient and weather-station data (shown as samples for now), map tiles offline, assistant voice
input and photo diagnosis. Each waits on a data source or an answer from the
agent team.
