import { describe, expect, it } from "vitest";
import type { Zone } from "../../device/types";
import { firstFreeValve, valveCountOf, valveOptions } from "./valves";

const zone = (zone: number, valve: number, name = `Z${zone}`): Zone => ({
  zone,
  name,
  valve,
  enabled: true,
  defaultSeconds: 600,
});
const zones = [zone(1, 1, "Front lawn"), zone(2, 3, "Hedge")];

describe("valveOptions", () => {
  it("lists every valve with the zone that uses it", () => {
    expect(valveOptions(4, zones)).toEqual([
      { valve: 1, takenBy: "Front lawn" },
      { valve: 2, takenBy: undefined },
      { valve: 3, takenBy: "Hedge" },
      { valve: 4, takenBy: undefined },
    ]);
  });

  it("doesn't count the zone being edited as taking its own valve", () => {
    expect(valveOptions(3, zones, 2)[2]).toEqual({
      valve: 3,
      takenBy: undefined,
    });
  });

  it("finds the first free valve, or none", () => {
    expect(firstFreeValve(valveOptions(4, zones))).toBe(2);
    expect(firstFreeValve(valveOptions(1, zones))).toBeUndefined();
  });
});

describe("valveCountOf", () => {
  it("uses the board's count, else 8 or the highest valve in use", () => {
    expect(valveCountOf(16, zones)).toBe(16);
    expect(valveCountOf(undefined, zones)).toBe(8);
    expect(valveCountOf(undefined, [zone(1, 12)])).toBe(12);
  });
});
