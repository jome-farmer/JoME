# ADR 0002 — AI assistant: the agent proposes, the app executes

- **Status:** Proposed
- **Date:** 2026-09-30

## Context

JoME has an AI agent backend. It uses fine-tuned models, agriculture data
sources (weather, crops, soil, water guides) and tools, and it can control the
irrigation system through the LLM. The app needs a chat assistant that works
like Claude chat but is specialised for the garden.

Two facts shape the design:

1. **The board may not be on the internet.** It might be reachable only
   through the phone, over BLE or USB ([ADR 0001](0001-cross-platform-framework.md)).
   A cloud agent can't always reach it directly.
2. **The model controls physical valves.** A wrong or hallucinated action wastes
   water, floods a bed or kills plants. Safety has to come from the app, not
   from the prompt.

## Decision

1. **Split tools by where they run.**
   - **Knowledge tools** (weather, crop database, soil, diagnosis) run on the
     agent backend. The app only sees their citations.
   - **Device tools** (read status, run zone, rain delay, edit programs) are
     returned to the app as tool calls. The app executes them through
     `DeviceClient` over whichever link is active and sends the results back.
     The same tools work over BLE, USB, or a future cloud link, and the agent
     never needs a direct path to the board.
2. **The app enforces safety, whatever the model says.**
   - _Read_ tools run automatically.
   - _Stop_ tools (`zone.stop`, `stop.all`) run automatically, because they
     close water.
   - _Act_ tools (start water, rain delay, change zones or programs) always
     show an **action card** that the user must confirm. Nothing opens a valve
     without a tap.
   - The app validates tool arguments and enforces limits (for example, a run
     longer than 60 minutes is rejected) before anything reaches the board.
3. **Stream responses** over Server-Sent Events, so the text appears as it is
   generated and action cards appear inline.
4. **The assistant is a feature like the others**, at `features/assistant/`,
   with its own tab. It depends on `device/` for tool execution, never the
   other way around.

## Consequences

- The assistant needs an internet connection. Offline, the tab shows a clear
  state, and the rest of the app works without it.
- Device context (status, zones, programs) is sent with each turn. That is
  garden data, and we need a privacy note and consent at first use.
- The tool list in [assistant.md](../assistant.md) becomes a second contract,
  kept in step with [device-protocol.md](../device-protocol.md).
- **Revisit** if the board gets its own cloud connection. The agent could then
  execute device tools server-side, but the confirmation rule stays.
