import { describe, expect, it } from "vitest";
import { formatZones } from "./zones";

describe("formatZones", () => {
  it("renders each returned zone in readable terminal text", () => {
    expect(
      formatZones([
        {
          zone: 1,
          name: "Front lawn",
          enabled: true,
          defaultSeconds: 600,
          valve: 3,
        },
        { zone: 2, name: "Pots", enabled: false, defaultSeconds: 90, valve: 2 },
      ]),
    ).toBe(
      "Zones:\n1. Front lawn · on · 10 min · valve 3\n2. Pots · off · 2 min · valve 2",
    );
  });

  it("handles a controller with no zones", () => {
    expect(formatZones([])).toBe("Zones: none");
  });
});
