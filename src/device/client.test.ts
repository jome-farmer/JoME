import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceClient, DeviceError, type TrafficLine } from "./client";
import type { Link } from "./link";

/** Minimal scripted link: records writes, lets the test feed board output. */
function fakeLink() {
  let dataCb: (b: Uint8Array) => void = () => {};
  let closeCb: (e?: Error) => void = () => {};
  const written: string[] = [];
  const link: Link = {
    kind: "mock",
    open: async () => {},
    close: async () => closeCb(),
    write: async (b) => {
      written.push(new TextDecoder().decode(b));
    },
    onData: (cb) => ((dataCb = cb), () => {}),
    onClose: (cb) => ((closeCb = cb), () => {}),
  };
  const feed = (s: string) => dataCb(new TextEncoder().encode(s));
  const lastRequest = () =>
    JSON.parse(written.at(-1)!) as { id: number; cmd: string; args: unknown };
  return {
    link,
    written,
    feed,
    lastRequest,
    drop: () => closeCb(new Error("gone")),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("DeviceClient", () => {
  it("sends a request line and resolves with the matching response", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const p = client.request("zone.run", { zone: 3, seconds: 600 });
    await flush();
    const req = f.lastRequest();
    expect(req).toEqual({
      id: 1,
      cmd: "zone.run",
      args: { zone: 3, seconds: 600 },
    });
    expect(f.written[0].endsWith("\n")).toBe(true);
    f.feed(`{"id":${req.id},"ok":true,"data":{}}\n`);
    await expect(p).resolves.toEqual({});
  });

  it("matches out-of-order responses by id", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const a = client.request("status", {});
    const b = client.request("zones.list", {});
    await flush();
    f.feed(
      '{"id":2,"ok":true,"data":{"zones":[]}}\n{"id":1,"ok":true,"data":{"running":[]}}\n',
    );
    await expect(b).resolves.toEqual({ zones: [] });
    await expect(a).resolves.toEqual({ running: [] });
  });

  it("rejects with the board's error code and message", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const p = client.request("zone.run", { zone: 3, seconds: 60 });
    await flush();
    f.feed(
      '{"id":1,"ok":false,"error":{"code":"ZONE_BUSY","message":"Zone 2 is running"}}\n',
    );
    await expect(p).rejects.toMatchObject({
      code: "ZONE_BUSY",
      message: "Zone 2 is running",
    });
  });

  it("times out, uses the longer wifi.scan timeout, and ignores a late answer", async () => {
    vi.useFakeTimers();
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const status = client.request("status", {});
    const scan = client.request("wifi.scan", {});
    const statusErr = expect(status).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(5_000);
    await statusErr;
    const scanErr = expect(scan).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000);
    await scanErr;
    expect(() => f.feed('{"id":1,"ok":true,"data":{}}\n')).not.toThrow();
  });

  it("rejects pending requests when the link drops", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const p = client.request("status", {});
    f.drop();
    await expect(p).rejects.toBeInstanceOf(DeviceError);
    await expect(p).rejects.toMatchObject({ code: "LINK_CLOSED" });
  });

  it("delivers events to subscribers until they unsubscribe", () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const seen: unknown[] = [];
    const off = client.on("zone.state", (d) => seen.push(d));
    f.feed(
      '{"evt":"zone.state","data":{"zone":3,"state":"watering","remaining":600}}\n',
    );
    off();
    f.feed('{"evt":"zone.state","data":{"zone":3,"state":"idle"}}\n');
    expect(seen).toEqual([{ zone: 3, state: "watering", remaining: 600 }]);
  });

  it("delivers typed program progress events", () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const seen: unknown[] = [];
    client.on("program.state", (d) => seen.push(d));
    f.feed(
      '{"evt":"program.state","data":{"program":2,"state":"step","step":1,"zone":3}}\n',
    );
    expect(seen).toEqual([{ program: 2, state: "step", step: 1, zone: 3 }]);
  });

  it("reports every rx and tx line for the terminal", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const lines: TrafficLine[] = [];
    client.onLine((l) => lines.push(l));
    await client.writeRaw("status");
    f.feed("I (5521) valve: zone 3 OPEN\n");
    expect(lines).toEqual([
      { dir: "tx", kind: "log", text: "status" },
      { dir: "rx", kind: "log", text: "I (5521) valve: zone 3 OPEN" },
    ]);
  });

  it("sends a message over the old 1024-byte limit", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    void client.request("device.rename", { name: "x".repeat(1100) });
    await Promise.resolve();
    await Promise.resolve();
    expect(f.written).toHaveLength(1);
  });

  it("refuses a message over 16 KiB instead of letting the board drop it", async () => {
    const f = fakeLink();
    const client = new DeviceClient(f.link);
    const huge = client.request("device.rename", { name: "x".repeat(17_000) });
    await expect(huge).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.written).toEqual([]);
  });

  it("writes one line at a time even if the link is slow", async () => {
    const f = fakeLink();
    const order: string[] = [];
    let release!: () => void;
    f.link.write = async (b) => {
      const text = new TextDecoder().decode(b);
      order.push(`start ${text.trim()}`);
      if (text.startsWith("first"))
        await new Promise<void>((r) => (release = r));
      order.push(`end ${text.trim()}`);
    };
    const client = new DeviceClient(f.link);
    const a = client.writeRaw("first");
    const b = client.writeRaw("second");
    await flush();
    release();
    await Promise.all([a, b]);
    expect(order).toEqual([
      "start first",
      "end first",
      "start second",
      "end second",
    ]);
  });
});
