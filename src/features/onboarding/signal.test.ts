import { expect, it } from "vitest";
import { signalLevel } from "./signal";

it("maps RSSI to bars, strongest at -55 dBm and up", () => {
  expect([-40, -60, -70, -90, undefined].map(signalLevel)).toEqual([
    4, 3, 2, 1, 0,
  ]);
});
