import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceClient, type TrafficLine } from "../client";
import { handshake } from "../handshake";
import type { Events } from "../types";
import { createMockLink } from "./mockLink";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function connected() {
  const link = createMockLink();
  await link.open();
  const client = new DeviceClient(link);
  /** Resolve a request while fake time moves past the board's reply latency. */
  const ask = async <T>(p: Promise<T>) => {
    await vi.advanceTimersByTimeAsync(100);
    return p;
  };
  return { link, client, ask };
}

describe("mock board", () => {
  it("passes the handshake", async () => {
    const { client } = await connected();
    const hello = handshake(client);
    await vi.advanceTimersByTimeAsync(200);
    await expect(hello).resolves.toMatchObject({
      proto: 1,
      serial: "JM-DEMO-0001",
      zoneCount: 6,
    });
  });

  it("runs a zone end to end: watering countdown, then idle", async () => {
    const { client, ask } = await connected();
    const states: Events["zone.state"][] = [];
    client.on("zone.state", (e) => states.push(e));

    await ask(client.request("zone.run", { zone: 3, seconds: 3 }));
    const status = await ask(client.request("status", {}));
    expect(status.running).toEqual([{ zone: 3, remaining: 3 }]);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(states.map((s) => [s.state, s.remaining])).toEqual([
      ["watering", 3],
      ["watering", 2],
      ["watering", 1],
      ["idle", undefined],
    ]);
    expect((await ask(client.request("status", {}))).running).toEqual([]);
  });

  it("runs one zone at a time and stops all", async () => {
    const { client, ask } = await connected();
    await ask(client.request("zone.run", { zone: 1, seconds: 600 }));
    const busy = client.request("zone.run", { zone: 2, seconds: 60 });
    const busyErr = expect(busy).rejects.toMatchObject({
      code: "ZONE_BUSY",
      message: "Zone 1 is running",
    });
    await vi.advanceTimersByTimeAsync(100);
    await busyErr;
    await ask(client.request("stop.all", {}));
    expect((await ask(client.request("status", {}))).running).toEqual([]);
  });

  it("refuses disabled zones, unknown zones and bad durations", async () => {
    const { client } = await connected();
    const cases = [
      [client.request("zone.run", { zone: 6, seconds: 60 }), "BAD_REQUEST"],
      [client.request("zone.run", { zone: 42, seconds: 60 }), "NOT_FOUND"],
      [client.request("zone.run", { zone: 1, seconds: 0 }), "BAD_REQUEST"],
      [client.request("zone.run", { zone: 1, seconds: 3601 }), "BAD_REQUEST"],
    ] as const;
    const checks = cases.map(([p, code]) =>
      expect(p).rejects.toMatchObject({ code }),
    );
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all(checks);
  });

  it("reports Wi‑Fi outcome as events, including a wrong password", async () => {
    const { client, ask } = await connected();
    const seen: string[] = [];
    client.on("wifi.state", (w) => seen.push(w.state));
    await ask(
      client.request("wifi.set", {
        ssid: "Greenhouse-AP",
        password: "wrong-password",
      }),
    );
    await vi.advanceTimersByTimeAsync(1_500);
    expect(seen).toEqual(["connecting", "failed"]);
  });

  it("saves, lists and deletes programs, and sets a rain delay", async () => {
    // Start on a whole second so the 100 ms reply latency can't cross into the next epoch second.
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const { client, ask } = await connected();
    const { id } = await ask(
      client.request("program.save", {
        name: "Lawn",
        enabled: true,
        days: [0],
        start: "07:00",
        steps: [{ zone: 1, seconds: 600 }],
      }),
    );
    expect(
      (await ask(client.request("programs.list", {}))).programs.map(
        (p) => p.id,
      ),
    ).toContain(id);
    await ask(client.request("program.delete", { id }));
    expect(
      (await ask(client.request("programs.list", {}))).programs.map(
        (p) => p.id,
      ),
    ).not.toContain(id);

    const { until } = await ask(client.request("rain.delay", { hours: 24 }));
    expect(until).toBe(Math.floor(Date.now() / 1000) + 24 * 3600);
    expect(
      (await ask(client.request("rain.delay", { hours: 0 }))).until,
    ).toBeNull();
  });

  it("answers unknown commands and raw terminal text without crashing", async () => {
    const { client } = await connected();
    const lines: TrafficLine[] = [];
    client.onLine((l) => lines.push(l));
    const unknown = client.request("nope" as never, {} as never);
    const unknownErr = expect(unknown).rejects.toMatchObject({
      code: "UNKNOWN_CMD",
    });
    await client.writeRaw("help");
    await vi.advanceTimersByTimeAsync(100);
    await unknownErr;
    expect(
      lines.some(
        (l) => l.dir === "rx" && l.text.includes("unknown command 'help'"),
      ),
    ).toBe(true);
  });

  it("stops talking after close", async () => {
    const { link, client } = await connected();
    let closed = false;
    link.onClose(() => (closed = true));
    await link.close();
    expect(closed).toBe(true);
    await expect(client.writeRaw("status")).rejects.toThrow();
  });
});
