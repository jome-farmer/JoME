import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDuration,
  formatTemperature,
  whenLabel,
} from "./format";

describe("formatTemperature", () => {
  it.each([
    [28.5, "28.5 °C"],
    [30, "30.0 °C"],
    [null, "— °C"],
  ])("%s → %s", (c, text) => expect(formatTemperature(c)).toBe(text));
});

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

describe("whenLabel", () => {
  const now = new Date(2026, 8, 30, 18, 10); // Wednesday
  const at = (d: Date) => d.getTime() / 1000;
  it("says today, tomorrow, or the weekday", () => {
    expect(whenLabel(at(new Date(2026, 8, 30, 21, 30)), now)).toBe(
      "today 21:30",
    );
    expect(whenLabel(at(new Date(2026, 9, 1, 6, 0)), now)).toBe(
      "tomorrow 06:00",
    );
    expect(whenLabel(at(new Date(2026, 9, 2, 6, 0)), now)).toBe("Friday 06:00");
  });
});
