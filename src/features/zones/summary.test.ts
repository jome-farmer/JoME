import { expect, it } from "vitest";
import type { Zone } from "../../device/types";
import { zoneSummary } from "./summary";

const zone = (n: number, enabled = true): Zone => ({
  zone: n,
  name: `Zone ${n}`,
  valve: n,
  enabled,
  defaultSeconds: 600,
});

it("counts running, idle and off zones, skipping zeros", () => {
  const zones = [zone(1), zone(2), zone(3), zone(6, false)];
  expect(zoneSummary(zones, 3)).toBe("1 running · 2 idle · 1 off");
  expect(zoneSummary(zones, null)).toBe("3 idle · 1 off");
  expect(zoneSummary([zone(1)], 1)).toBe("1 running");
  expect(zoneSummary([], null)).toBe("No zones yet");
});
