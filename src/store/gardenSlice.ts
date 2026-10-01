import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { DeviceClient } from "../services/device/client";
import type {
  Events,
  Program,
  Sensors,
  Status,
  Zone,
} from "../services/device/types";
import { getClient } from "./connection";
import { deviceClosed, deviceReady } from "./deviceSlice";
import type { AppThunk, RootState } from ".";

export type Run = {
  zone: number;
  /** Seconds left when last reported by the board. */
  remaining: number;
  total: number;
  /** Present when the board scheduler, rather than zone.run, started it. */
  program?: number;
  /** One-based step in `program`; present with program. */
  step?: number;
  /** Date.now() of that report, so we can count down smoothly in between. */
  at: number;
};

export type ZonePatch = Partial<Omit<Zone, "zone">>;

type GardenState = {
  /** The board this copy is from. */
  serial?: string;
  status?: Status;
  zones: Zone[];
  programs: Program[];
  run: Run | null;
  /** Latest sensors.read; undefined until read. */
  sensors?: Sensors;
  /** Why the last refresh failed. */
  error?: string;
};

const initialState: GardenState = { zones: [], programs: [], run: null };

const runOf = (s: Status, at: number): Run | null => {
  const r = s.running[0];
  return r ? { ...r, at } : null;
};

/** The live view of the board: one copy for Home, Zones, Schedule, Device and the assistant. */
const gardenSlice = createSlice({
  name: "garden",
  initialState,
  reducers: {
    refreshed: {
      reducer: (
        s,
        {
          payload,
        }: PayloadAction<{
          status: Status;
          zones: Zone[];
          programs: Program[];
          at: number;
        }>,
      ) => {
        s.status = payload.status;
        s.run = runOf(payload.status, payload.at);
        s.zones = payload.zones;
        s.programs = payload.programs;
        s.error = undefined;
      },
      prepare: (p: { status: Status; zones: Zone[]; programs: Program[] }) => ({
        payload: { ...p, at: Date.now() },
      }),
    },
    refreshFailed: (s, { payload }: PayloadAction<string>) => {
      s.error = payload;
    },
    statusReceived: {
      reducer: (
        s,
        { payload }: PayloadAction<{ status: Status; at: number }>,
      ) => {
        s.status = payload.status;
        s.run = runOf(payload.status, payload.at);
      },
      prepare: (status: Status) => ({ payload: { status, at: Date.now() } }),
    },
    zoneState: {
      reducer: (
        s,
        { payload }: PayloadAction<Events["zone.state"] & { at: number }>,
      ) => {
        const { zone, state, remaining, total, at } = payload;
        if (state === "watering" && remaining !== undefined) {
          if (total !== undefined) s.run = { zone, remaining, total, at };
        } else if (s.run?.zone === zone) s.run = null;
      },
      prepare: (e: Events["zone.state"]) => ({
        payload: { ...e, at: Date.now() },
      }),
    },
    programStep: (s, { payload }: PayloadAction<Events["program.state"]>) => {
      const { zone, step, state, program } = payload;
      if (state !== "step" || zone === undefined || step === undefined) return;
      if (s.run?.zone === zone) Object.assign(s.run, { program, step });
    },
    sensorsRead: (s, { payload }: PayloadAction<Sensors>) => {
      s.sensors = payload;
    },
    zonesChanged: (s, { payload }: PayloadAction<Zone[]>) => {
      s.zones = payload;
    },
    programsChanged: (s, { payload }: PayloadAction<Program[]>) => {
      s.programs = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(deviceReady, (s, { payload }) =>
        payload.info?.serial === s.serial
          ? s
          : { ...initialState, serial: payload.info?.serial },
      )
      .addCase(deviceClosed, () => initialState);
  },
});

export const gardenReducer = gardenSlice.reducer;
export const { statusReceived, zoneState, programStep } = gardenSlice.actions;
const { refreshed, refreshFailed, sensorsRead, zonesChanged, programsChanged } =
  gardenSlice.actions;

export const selectGarden = (s: RootState) => s.garden;

/** The client while the board is ready; changes need it. */
function client(getState: () => RootState): DeviceClient {
  const c = getState().device.state === "ready" ? getClient() : undefined;
  if (!c) throw new Error("Not connected");
  return c;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Status, zones and programs, all at once. A failure is kept in `error`, not thrown. */
export const refreshGarden =
  (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    try {
      const c = client(getState);
      const [status, z, p] = await Promise.all([
        c.request("status", {}),
        c.request("zones.list", {}),
        c.request("programs.list", {}),
      ]);
      dispatch(refreshed({ status, zones: z.zones, programs: p.programs }));
    } catch (e) {
      dispatch(refreshFailed(message(e)));
    }
  };

/** Ask for status once, e.g. when a run ended and the next may have moved on. */
export const refreshStatus =
  (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    try {
      dispatch(statusReceived(await client(getState).request("status", {})));
    } catch {
      // The next status event or refresh catches up.
    }
  };

export const readSensors =
  (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    try {
      dispatch(sensorsRead(await client(getState).request("sensors.read", {})));
    } catch {
      // Keep the last reading; the next tick tries again.
    }
  };

export const runZone =
  (zone: number, seconds: number): AppThunk<Promise<void>> =>
  async (_, getState) => {
    await client(getState).request("zone.run", { zone, seconds });
  };

export const stopZone =
  (zone: number): AppThunk<Promise<void>> =>
  async (_, getState) => {
    await client(getState).request("zone.stop", { zone });
  };

/** Optimistic: the change shows at once and rolls back if the board refuses it. */
export const updateZone =
  (zone: number, patch: ZonePatch): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const c = client(getState);
    const before = getState().garden.zones;
    dispatch(
      zonesChanged(
        before.map((z) => (z.zone === zone ? { ...z, ...patch } : z)),
      ),
    );
    try {
      await c.request("zone.update", { zone, ...patch });
    } catch (e) {
      const restore = before.find((z) => z.zone === zone);
      if (restore)
        dispatch(
          zonesChanged(
            getState().garden.zones.map((z) => (z.zone === zone ? restore : z)),
          ),
        );
      throw e;
    }
  };

/** Add a zone on a free valve. */
export const createZone =
  (zone: {
    name: string;
    valve: number;
    defaultSeconds: number;
  }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    await client(getState).request("zone.create", zone);
    await dispatch(refreshGarden());
  };

/** Remove a zone: programs stop watering it and its valve becomes free. */
export const deleteZone =
  (zone: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    await client(getState).request("zone.delete", { zone });
    await dispatch(refreshGarden());
  };

/** Create (no id) or replace a program; the board may adjust it, so reload the list. */
export const saveProgram =
  (program: Program): AppThunk<Promise<number>> =>
  async (dispatch, getState) => {
    const c = client(getState);
    const { id } = await c.request("program.save", program);
    dispatch(programsChanged((await c.request("programs.list", {})).programs));
    return id;
  };

export const deleteProgram =
  (id: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    await client(getState).request("program.delete", { id });
    dispatch(
      programsChanged(getState().garden.programs.filter((p) => p.id !== id)),
    );
  };

/** Optimistic on/off switch; rolls back if the board refuses. */
export const setProgramEnabled =
  (program: Program, enabled: boolean): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const c = client(getState);
    const swap = (p: Program) =>
      programsChanged(
        getState().garden.programs.map((x) => (x.id === p.id ? p : x)),
      );
    dispatch(swap({ ...program, enabled }));
    try {
      await c.request("program.save", { ...program, enabled });
    } catch (e) {
      dispatch(swap(program));
      throw e;
    }
  };
