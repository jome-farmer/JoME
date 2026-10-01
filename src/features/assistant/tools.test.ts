import { describe, expect, it, vi } from "vitest";
import type { DeviceClient } from "../../services/device/client";
import type { Program, Zone } from "../../services/device/types";
import { planTool } from "./tools";

const zones: Zone[] = [
  {
    zone: 1,
    name: "Front lawn",
    valve: 1,
    enabled: true,
    defaultSeconds: 1200,
  },
  {
    zone: 3,
    name: "Vegetable beds",
    valve: 5,
    enabled: true,
    defaultSeconds: 600,
  },
  { zone: 6, name: "Pool side", valve: 6, enabled: false, defaultSeconds: 600 },
];
const programs: Program[] = [
  {
    id: 2,
    name: "Evening",
    enabled: true,
    days: [0, 1, 2, 3, 4, 5, 6],
    start: "18:00",
    steps: [{ zone: 3, seconds: 600 }],
  },
];
const ctx = {
  zones,
  programs,
  now: new Date(2026, 8, 30, 18, 0),
  canMoveValve: true,
};
const plan = (name: string, args: Record<string, unknown> = {}) =>
  planTool(name, args, ctx);

describe("tiers", () => {
  it("reads and stops run on their own; anything that starts water or changes the plan needs Confirm", () => {
    const tiers = Object.fromEntries(
      [
        ["get_status", {}],
        ["list_zones", {}],
        ["list_programs", {}],
        ["stop_zone", { zone: 1 }],
        ["stop_all", {}],
        ["run_zone", { zone: 3, seconds: 600 }],
        ["set_rain_delay", { hours: 24 }],
        ["update_zone", { zone: 1, name: "Lawn" }],
        [
          "save_program",
          {
            name: "M",
            days: [1],
            start: "06:00",
            steps: [{ zone: 1, seconds: 600 }],
          },
        ],
        ["delete_program", { id: 2 }],
      ].map(([n, a]) => {
        const p = plan(n as string, a as Record<string, unknown>);
        return [n, p.ok ? p.tier : p.code];
      }),
    );
    expect(tiers).toEqual({
      get_status: "read",
      list_zones: "read",
      list_programs: "read",
      stop_zone: "stop",
      stop_all: "stop",
      run_zone: "act",
      set_rain_delay: "act",
      update_zone: "act",
      save_program: "act",
      delete_program: "act",
    });
  });
});

describe("refusals", () => {
  it.each([
    ["an unknown tool", "open_all_valves", {}, "UNKNOWN_TOOL"],
    ["a prototype key as a tool", "constructor", {}, "UNKNOWN_TOOL"],
    ["a missing zone", "run_zone", { zone: 9, seconds: 600 }, "NOT_FOUND"],
    ["a turned-off zone", "run_zone", { zone: 6, seconds: 600 }, "BAD_REQUEST"],
    [
      "a run over 60 min",
      "run_zone",
      { zone: 1, seconds: 3601 },
      "BAD_REQUEST",
    ],
    ["a run under 1 min", "run_zone", { zone: 1, seconds: 30 }, "BAD_REQUEST"],
    ["seconds as text", "run_zone", { zone: 1, seconds: "600" }, "BAD_REQUEST"],
    [
      "a rain delay over a week",
      "set_rain_delay",
      { hours: 169 },
      "BAD_REQUEST",
    ],
    ["a taken valve", "update_zone", { zone: 1, valve: 5 }, "VALVE_IN_USE"],
  ])("refuses %s", (_, name, args, code) => {
    const p = plan(name as string, args as Record<string, unknown>);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.code).toBe(code);
  });

  it("refuses a valve change on boards that can't move zones (firmware v1)", () => {
    const p = planTool(
      "update_zone",
      { zone: 1, valve: 2 },
      { ...ctx, canMoveValve: false },
    );
    expect(p.ok ? p.tier : p.code).toBe("UNKNOWN_CMD");
  });

  it.each([
    ["an empty zone update", "update_zone", { zone: 1 }, "BAD_REQUEST"],
    [
      "a program with 17 steps",
      "save_program",
      {
        name: "X",
        days: [1],
        start: "06:00",
        steps: Array(17).fill({ zone: 1, seconds: 60 }),
      },
      "BAD_REQUEST",
    ],
    [
      "a program at 25:00",
      "save_program",
      {
        name: "X",
        days: [1],
        start: "25:00",
        steps: [{ zone: 1, seconds: 60 }],
      },
      "BAD_REQUEST",
    ],
    [
      "a program on day 7",
      "save_program",
      {
        name: "X",
        days: [7],
        start: "06:00",
        steps: [{ zone: 1, seconds: 60 }],
      },
      "BAD_REQUEST",
    ],
    ["deleting a missing program", "delete_program", { id: 99 }, "NOT_FOUND"],
  ])("refuses %s", (_, name, args, code) => {
    const p = plan(name as string, args as Record<string, unknown>);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.code).toBe(code);
  });
});

describe("cards", () => {
  it("describe the action in plain words", () => {
    const run = plan("run_zone", { zone: 3, seconds: 600 });
    expect(run.ok && [run.summary, run.detail, run.water]).toEqual([
      "Run Vegetable beds for 10 min",
      "Valve 5. You can stop it any time.",
      true,
    ]);
    const rain = plan("set_rain_delay", { hours: 24 });
    expect(rain.ok && [rain.summary, rain.detail]).toEqual([
      "Rain delay, 24 h",
      "Programs skip their runs until tomorrow 18:00.",
    ]);
    const change = plan("save_program", {
      id: 2,
      name: "Evening",
      days: [1, 3],
      start: "19:00",
      steps: [{ zone: 1, seconds: 900 }],
    });
    expect(change.ok && change.detail).toBe(
      "S M T W T F S · 18:00 · 1 zone → M W · 19:00 · 1 zone · 15 min",
    );
  });

  it("only sends the checked arguments to the board", async () => {
    const request = vi.fn().mockResolvedValue({});
    const client = { request } as unknown as DeviceClient;
    const p = plan("run_zone", {
      zone: 3,
      seconds: 600,
      valve: 1,
      extra: "ignored",
    });
    if (!p.ok) throw new Error("expected a plan");
    await p.run(client);
    expect(request).toHaveBeenCalledWith("zone.run", { zone: 3, seconds: 600 });
  });
});
