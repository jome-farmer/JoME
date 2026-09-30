import { describe, expect, it, vi } from "vitest";
import { DeviceClient } from "./client";
import { createMockLink } from "./links/mockLink";
import type { Zone } from "./types";
import { deleteFixedZone, gardenZones, isFreeFixedZone } from "./useGarden";

const z = (
  zone: number,
  name: string,
  enabled: boolean,
  valve?: number,
): Zone => ({
  zone,
  name,
  enabled,
  defaultSeconds: 600,
  ...(valve !== undefined && { valve }),
});

describe("fixed-zone boards (firmware v1)", () => {
  const board = [
    z(1, "Front lawn", true),
    z(2, "Zone 2", false), // untouched: a free valve
    z(3, "Pool side", false), // named but off: the user's zone, turned off
    z(4, "Zone 4", true), // default name but on: in use
  ];

  it("treats a zone that's off and still named Zone N as a free valve", () => {
    expect(board.map(isFreeFixedZone)).toEqual([false, true, false, false]);
  });

  it("lists only used zones, with the zone number as the valve", () => {
    expect(
      gardenZones(board, false).map((g) => [g.zone, g.valve, g.name]),
    ).toEqual([
      [1, 1, "Front lawn"],
      [3, 3, "Pool side"],
      [4, 4, "Zone 4"],
    ]);
  });
});

describe("boards with valves (SHamBE#19)", () => {
  it("lists every zone with the valve the board reports", () => {
    const board = [z(1, "Front lawn", true, 5), z(2, "Zone 2", false, 2)];
    expect(gardenZones(board, true).map((g) => [g.zone, g.valve])).toEqual([
      [1, 5],
      [2, 2],
    ]);
  });
});

describe("deleting a zone on a fixed-zone board", () => {
  it("takes it out of programs, turns off programs left empty, and frees the valve", async () => {
    vi.useFakeTimers();
    const link = createMockLink({ valves: false });
    await link.open();
    const client = new DeviceClient(link);
    const ask = async <T>(p: Promise<T>) => {
      await vi.advanceTimersByTimeAsync(100);
      return p;
    };
    const { programs } = await ask(client.request("programs.list", {}));
    // Zone 5 ("Pots") is in Evening (with zone 3) and is the only step of Drip pots.
    const done = deleteFixedZone(client, programs, 5);
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    const after = await ask(client.request("programs.list", {}));
    const byName = Object.fromEntries(after.programs.map((p) => [p.name, p]));
    expect(byName.Evening.steps.map((s) => s.zone)).toEqual([3]);
    expect(byName["Drip pots"].enabled).toBe(false);
    const { zones } = await ask(client.request("zones.list", {}));
    expect(isFreeFixedZone(zones.find((z) => z.zone === 5)!)).toBe(true);
    vi.useRealTimers();
  });
});
