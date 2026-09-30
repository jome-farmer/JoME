import { describe, expect, it } from "vitest";
import { formatClock, formatDuration } from "./format";

describe("formatDuration", () => {
  it.each([
    [0, "0 s"],
    [45, "45 s"],
    [60, "1 min"],
    [420, "7 min"],
    [449, "7 min"],
    [3600, "1 h"],
    [4800, "1 h 20 min"],
    [3570, "1 h"], // 59.5 min rounds up to a whole hour
    [-5, "0 s"],
  ])("%i s → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("formatClock", () => {
  it.each([
    [402, "6:42"],
    [59, "0:59"],
    [0, "0:00"],
    [3900, "1:05:00"],
    [-3, "0:00"],
    [9.9, "0:09"],
  ])("%i s → %s", (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });
});
