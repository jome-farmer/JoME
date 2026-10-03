import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetDevice, getKnownDevices, rememberDevice } from "../lib/storage";
import { makeStore } from ".";
import { conn, getClient } from "./connection";
import {
  autoConnect,
  connectDemo,
  disconnect,
  rename,
  serverChanged,
  restart,
} from "./deviceSlice";

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

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await makeStore().dispatch(disconnect({ forget: true }));
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("device", () => {
  it("connects to the demo board: connecting, then ready with its hello", async () => {
    const store = makeStore();
    const done = store.dispatch(connectDemo());
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().device).toEqual({
      state: "connecting",
      linkKind: "mock",
    });
    await settle(done);
    const { state, info, linkKind } = store.getState().device;
    expect({ state, linkKind }).toEqual({ state: "ready", linkKind: "mock" });
    expect(info?.serial).toBeTruthy();
    expect(getClient()).toBeDefined();
    expect(rememberDevice).toHaveBeenCalledWith(
      expect.objectContaining({ serial: info?.serial, lastLink: "mock" }),
    );
  });

  it("keeps the board's latest server.state until the connection changes", async () => {
    const store = makeStore();
    await settle(store.dispatch(connectDemo()));
    expect(store.getState().device.server).toBeUndefined();
    store.dispatch(serverChanged({ state: "connecting" }));
    store.dispatch(serverChanged({ state: "failed", reason: "REVOKED" }));
    expect(store.getState().device.server).toEqual({
      state: "failed",
      reason: "REVOKED",
    });
    // A new connection starts without a guess about the old one.
    await settle(store.dispatch(connectDemo()));
    expect(store.getState().device.server).toBeUndefined();
  });

  it("renames the board and keeps the new name", async () => {
    const store = makeStore();
    await settle(store.dispatch(connectDemo()));
    await settle(store.dispatch(rename("Back yard")));
    expect(store.getState().device.info?.name).toBe("Back yard");
  });

  it("restart: lost while the board reboots, then ready again", async () => {
    const store = makeStore();
    await settle(store.dispatch(connectDemo()));
    const serial = store.getState().device.info?.serial;
    const done = store.dispatch(restart());
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().device).toMatchObject({
      state: "lost",
      error: "The connection to JoME was lost.",
      info: { serial },
    });
    await settle(done, 5000);
    expect(store.getState().device.state).toBe("ready");
  });

  it("disconnect with forget: idle, and the board is forgotten", async () => {
    const store = makeStore();
    await settle(store.dispatch(connectDemo()));
    const serial = store.getState().device.info!.serial;
    await store.dispatch(disconnect({ forget: true }));
    expect(store.getState().device).toEqual({ state: "idle" });
    expect(forgetDevice).toHaveBeenCalledWith(serial);
    expect(conn.demoLink).toBeNull();
    expect(getClient()).toBeUndefined();
  });

  it("at launch, goes back to the demo if that's where they left off", async () => {
    vi.mocked(getKnownDevices).mockResolvedValue([
      { serial: "demo", name: "Demo", lastLink: "mock", lastSeen: 0 },
    ]);
    const store = makeStore();
    await settle(store.dispatch(autoConnect("signedOut", { launch: true })));
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().device.state).toBe("ready");
  });
});
