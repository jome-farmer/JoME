import { describe, expect, it } from "vitest";
import { dailyLiters, isoDay, totals, previousLiters } from "./usage";

const usage = {
  days: [
    { date: "2026-09-27", liters: 120.5 },
    { date: "2026-10-01", liters: 80 },
  ],
  zones: [
    { zone: 1, liters: 150.5, seconds: 900 },
    { zone: 3, liters: 50, seconds: 300 },
  ],
};

describe("dailyLiters", () => {
  it("lists every day of the period with zeros for days without use", () => {
    const days = dailyLiters(usage, 7, new Date(2026, 9, 1, 15, 0));
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(days.map((d) => d.liters)).toEqual([0, 0, 120.5, 0, 0, 0, 80]);
  });

  it("crosses month and year ends", () => {
    const days = dailyLiters({ days: [], zones: [] }, 3, new Date(2027, 0, 1));
    expect(days.map((d) => d.date)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });
});

describe("totals", () => {
  it("adds litres and watering time over zones", () => {
    expect(totals(usage)).toEqual({ liters: 200.5, seconds: 1200 });
  });
});

describe("isoDay", () => {
  it("pads month and day", () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("previousLiters", () => {
  const today = new Date(2025, 8, 30);
  it("sums the period before the latest one", () => {
    const u = {
      days: [
        { date: "2025-09-20", liters: 40 },
        { date: "2025-09-23", liters: 60 },
        { date: "2025-09-28", liters: 500 },
      ],
      zones: [],
    };
    expect(previousLiters(u, 7, today)).toBe(100);
  });
  it("is undefined when nothing was logged before", () => {
    const u = { days: [{ date: "2025-09-29", liters: 10 }], zones: [] };
    expect(previousLiters(u, 7, today)).toBeUndefined();
  });
});
