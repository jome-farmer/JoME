import { describe, expect, it } from "vitest";
import type { Program, Zone } from "../../services/device/types";
import {
  moveStep,
  newProgram,
  programProblems,
  stepsLabel,
  totalSeconds,
} from "./program";

const zones: Zone[] = [
  {
    zone: 1,
    name: "Front lawn",
    valve: 1,
    enabled: true,
    defaultSeconds: 1200,
  },
  { zone: 2, name: "Hedge", valve: 2, enabled: true, defaultSeconds: 900 },
  { zone: 3, name: "Pool side", valve: 6, enabled: false, defaultSeconds: 600 },
];
const ok: Program = {
  name: "Morning",
  enabled: true,
  days: [1, 3],
  start: "06:00",
  steps: [
    { zone: 1, seconds: 1200 },
    { zone: 2, seconds: 900 },
  ],
};

describe("programProblems", () => {
  it("accepts a complete program", () => {
    expect(programProblems(ok, zones)).toEqual([]);
  });

  it("explains each problem in plain words", () => {
    const bad: Program = {
      name: " ",
      enabled: true,
      days: [],
      start: "25:00",
      steps: [{ zone: 9, seconds: 30 }],
    };
    expect(programProblems(bad, zones)).toEqual([
      "Give the program a name.",
      "Pick at least one day.",
      "Pick a start time.",
      "Each zone runs 1 to 60 minutes.",
      "A zone in this program no longer exists. Remove it.",
    ]);
    expect(programProblems({ ...ok, steps: [] }, zones)).toEqual([
      "Add at least one zone to water.",
    ]);
  });
});

describe("helpers", () => {
  it("totals and labels the steps", () => {
    expect(totalSeconds(ok)).toBe(2100);
    expect(stepsLabel(ok, zones)).toBe("Front lawn → Hedge");
    expect(
      stepsLabel(
        { steps: [1, 2, 1, 2].map((zone) => ({ zone, seconds: 60 })) },
        zones,
      ),
    ).toBe("4 zones");
  });

  it("starts new programs on the first enabled zone at its default time", () => {
    expect(newProgram(zones).steps).toEqual([{ zone: 1, seconds: 1200 }]);
    expect(newProgram([]).steps).toEqual([]);
  });

  it("moves steps within bounds", () => {
    expect(moveStep(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveStep(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
