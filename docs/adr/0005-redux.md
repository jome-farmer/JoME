# ADR 0005 — Redux Toolkit for app state

- **Status:** Proposed
- **Date:** 2026-10-01

## Context

App state lived in React context providers (`AuthProvider`, `DeviceProvider`)
and in `useGarden`, which each screen mounted on its own. Home, Zones and
Schedule each loaded and held their own copy of status, zones and programs.
There was no single source of truth and no way to inspect state.

## Decision

Use **Redux Toolkit** (`@reduxjs/toolkit` + `react-redux`). The store, slices
and selectors live in `src/store/`:

- `index.ts`: `configureStore`, `RootState`, `AppThunk`, and the typed hooks
  `useAppDispatch` / `useAppSelector`.
- One slice per area: `authSlice` (session state, user), `deviceSlice`
  (connection state, info, link kind, offline / `syncedAt`, error) and
  `gardenSlice` (status, zones, programs, running zone, sensors).
- **Side effects are plain thunks over `src/services/`.** Screens dispatch
  thunks and read with selectors.

**Not RTK Query or GraphQL.** DouSHamBE is a small REST API (docs/cloud.md),
and most board data arrives as protocol replies and events through
`DeviceClient` (BLE, USB or `cloudLink`), which a request cache can't model.
GraphQL would need a new server schema and a client library for a handful of
endpoints. RTK Query can be added over the same `services/` later if the
server grows many read endpoints.

**What stays out of the store:** anything not serializable. The live `Link` and
`DeviceClient` sit in a module next to the store (`src/store/connection.ts`),
which thunks read. The access token stays in `services/client` and secure
storage, so it never shows in devtools.

## Consequences

- Layers: `app → features → ui | device | store → services → lib`.
- The move goes slice by slice, one PR each: auth (with this ADR), device,
  garden. Until the last one lands, board data stays in `useGarden`.
- Slices and thunks are tested with Vitest against a real store and mocked
  services.
