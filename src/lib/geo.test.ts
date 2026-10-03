import { describe, expect, it } from "vitest";
import { shapeArea } from "./geo";

describe("shapeArea", () => {
  it("measures a 100 m × 50 m plot near Tehran", () => {
    const lat = 35.7;
    const dLat = 100 / 111_195; // 100 m north
    const dLon = 50 / (111_195 * Math.cos((lat * Math.PI) / 180)); // 50 m east
    const plot: [number, number][] = [
      [lat, 51.4],
      [lat + dLat, 51.4],
      [lat + dLat, 51.4 + dLon],
      [lat, 51.4 + dLon],
    ];
    expect(shapeArea(plot)).toBeCloseTo(5000, -1);
  });
  it("is 0 until there are three corners", () => {
    expect(
      shapeArea([
        [35, 51],
        [35.001, 51],
      ]),
    ).toBe(0);
  });
});
