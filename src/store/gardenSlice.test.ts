import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStore } from ".";
import { connectDemo, disconnect } from "./deviceSlice";
import {
  deleteProgram,
  refreshGarden,
  runZone,
  saveProgram,
  setProgramEnabled,
  updateZone,
  zoneState,
} from "./gardenSlice";

vi.mock("../lib/storage", () => ({
  getKnownDevices: vi.fn(() => Promise.resolve([])),
  rememberDevice: vi.fn(() => Promise.resolve()),
  forgetDevice: vi.fn(() => Promise.resolve()),
  addKnownDevices: vi.fn(() => Promise.resolve()),
}));
vi.mock("../services/devices", () => ({ listDevices: vi.fn() }));

/** Run a thunk while fake time moves past the demo board's reply latency. */
async function settle<T>(p: Promise<T>, ms = 1000): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return p;
}

/** A store connected to a fresh demo board, with the garden loaded. */
async function connected() {
  const store = makeStore();
  await settle(store.dispatch(connectDemo()));
  await settle(store.dispatch(refreshGarden()));
  return store;
}

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await makeStore().dispatch(disconnect({ forget: true }));
  vi.useRealTimers();
});

describe("garden", () => {
  it("loads status, zones and programs, and keeps the board it's from", async () => {
    const store = await connected();
    const garden = store.getState().garden;
    expect(garden.status).toBeDefined();
    expect(garden.zones.length).toBeGreaterThan(0);
    expect(garden.programs.length).toBeGreaterThan(0);
    expect(garden.serial).toBe(store.getState().device.info?.serial);
    expect(garden.error).toBeUndefined();
  });

  it("a refresh without a board keeps the reason, not a throw", async () => {
    const store = makeStore();
    await store.dispatch(refreshGarden());
    expect(store.getState().garden.error).toBe("Not connected");
  });

  it("a zone change shows at once and rolls back when the board refuses", async () => {
    const store = await connected();
    const [first] = store.getState().garden.zones;
    const renaming = store.dispatch(updateZone(first.zone, { name: "Roses" }));
    expect(store.getState().garden.zones[0].name).toBe("Roses");
    await settle(renaming);

    const moving = store.dispatch(updateZone(first.zone, { valve: 99 }));
    expect(store.getState().garden.zones[0].valve).toBe(99);
    const refused = expect(moving).rejects.toThrow("Valve must be");
    await vi.advanceTimersByTimeAsync(1000);
    await refused;
    expect(store.getState().garden.zones[0]).toMatchObject({
      name: "Roses",
      valve: first.valve,
    });
  });

  it("saves, switches off and deletes a program", async () => {
    const store = await connected();
    const [p] = store.getState().garden.programs;
    const id = await settle(
      store.dispatch(saveProgram({ ...p, id: undefined, name: "Copy" })),
    );
    expect(store.getState().garden.programs.map((x) => x.name)).toContain(
      "Copy",
    );
    const copy = store.getState().garden.programs.find((x) => x.id === id)!;
    await settle(store.dispatch(setProgramEnabled(copy, false)));
    expect(
      store.getState().garden.programs.find((x) => x.id === id)?.enabled,
    ).toBe(false);
    await settle(store.dispatch(deleteProgram(id)));
    expect(store.getState().garden.programs.some((x) => x.id === id)).toBe(
      false,
    );
  });

  it("follows zone events: a run starts, then ends", async () => {
    const store = await connected();
    const [z] = store.getState().garden.zones;
    store.dispatch(
      zoneState({ zone: z.zone, state: "watering", remaining: 60, total: 60 }),
    );
    expect(store.getState().garden.run).toMatchObject({
      zone: z.zone,
      remaining: 60,
    });
    store.dispatch(zoneState({ zone: z.zone, state: "idle" }));
    expect(store.getState().garden.run).toBeNull();
  });

  it("starting a zone needs the board", async () => {
    const store = makeStore();
    await expect(store.dispatch(runZone(1, 60))).rejects.toThrow(
      "Not connected",
    );
  });

  it("disconnecting clears the garden", async () => {
    const store = await connected();
    await store.dispatch(disconnect());
    expect(store.getState().garden).toEqual({
      zones: [],
      programs: [],
      run: null,
    });
  });
});
