import { describe, expect, it } from "vitest";
import { clamp, remainingFraction } from "./math";

describe("clamp", () => {
  it("keeps values inside the range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(11, 1, 10)).toBe(10);
  });
});

describe("remainingFraction", () => {
  it.each([
    [402, 600, 0.67],
    [600, 600, 1],
    [0, 600, 0],
    [700, 600, 1],
    [-1, 600, 0],
    [10, 0, 0],
  ])("%i of %i → %f", (remaining, total, expected) => {
    expect(remainingFraction(remaining, total)).toBeCloseTo(expected, 2);
  });
});
