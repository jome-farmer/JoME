import { describe, expect, it } from "vitest";
import { terminalBanner } from "./banner";

describe("terminalBanner", () => {
  it("identifies the link and controller", () => {
    expect(
      terminalBanner(
        {
          proto: 1,
          fw: "1.4.2",
          hw: "SIM",
          serial: "JM-1",
          name: "Garden",
          zoneCount: 6,
          valveCount: 8,
          cmds: [],
        },
        "ble",
      ),
    ).toBe(
      "JoME terminal · Bluetooth\nGarden · JM-1 · firmware 1.4.2\n6 zones · 8 valves\nType help for commands.",
    );
  });
});
