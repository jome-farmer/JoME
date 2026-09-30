import { describe, expect, it } from "vitest";
import type { Program } from "../../device/types";
import { greeting, todayRuns, whenLabel } from "./today";

const program = (p: Partial<Program>): Program => ({
  id: 1,
  name: "P",
  enabled: true,
  days: [0, 1, 2, 3, 4, 5, 6],
  start: "06:00",
  steps: [{ zone: 1, seconds: 1200 }],
  ...p,
});

describe("todayRuns", () => {
  // Wednesday 30 Sep 2026, 18:10 local time.
  const now = new Date(2026, 8, 30, 18, 10);

  it("lists today's enabled programs in start order and marks their state", () => {
    const runs = todayRuns(
      [
        program({ id: 3, name: "Drip", start: "21:30" }),
        program({
          id: 2,
          name: "Evening",
          start: "18:00",
          steps: [{ zone: 3, seconds: 1800 }],
        }),
        program({ id: 1, name: "Morning", start: "06:00" }),
      ],
      now,
    );
    expect(runs.map((r) => [r.program.name, r.state])).toEqual([
      ["Morning", "done"],
      ["Evening", "now"],
      ["Drip", "upcoming"],
    ]);
    expect(runs[1].seconds).toBe(1800);
  });

  it("skips disabled programs and other days", () => {
    expect(
      todayRuns(
        [program({ enabled: false }), program({ days: [1, 5] })], // Wednesday is 3
        now,
      ),
    ).toEqual([]);
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect([6, 13, 18, 23, 3].map(greeting)).toEqual([
      "Good morning",
      "Good afternoon",
      "Good evening",
      "Good night",
      "Good night",
    ]);
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
