import type { DeviceClient } from "../../device/client";
import type { Program, Zone } from "../../device/types";
import { formatDuration, whenLabel } from "../../lib/format";

/**
 * The safety boundary for agent tool calls (ADR 0002). Enforced here, never in the prompt:
 * - unknown tools are refused
 * - arguments are checked against app-side limits before anything reaches the board
 * - read and stop tools run on their own; act tools need the user's Confirm
 */
export type Tier = "read" | "stop" | "act";

export type Plan =
  | {
      ok: true;
      tier: Tier;
      /** Plain words for the card or trace line: "Run Vegetable beds for 10 min". */
      summary: string;
      detail?: string;
      /** True when running it opens a valve (the card turns water blue while it runs). */
      water?: boolean;
      run: (client: DeviceClient) => Promise<unknown>;
    }
  | { ok: false; code: string; message: string };

type Ctx = {
  zones: Zone[];
  programs: Program[];
  now: Date;
  /** Only boards with zone.create (SHamBE#19) can move a zone to another valve. */
  canMoveValve?: boolean;
};

const MAX_RUN_MIN = 60;
const MAX_DELAY_H = 168;
const MAX_STEPS = 16;
const MAX_NAME = 32;

class Refuse extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const bad = (message: string) => new Refuse("BAD_REQUEST", message);

const int = (v: unknown, what: string, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)
    throw bad(`${what} must be a whole number from ${min} to ${max}`);
  return v;
};
const zoneOf = (ctx: Ctx, v: unknown) => {
  const z = ctx.zones.find((x) => x.zone === v);
  if (!z) throw new Refuse("NOT_FOUND", `There is no zone ${String(v)}`);
  return z;
};
const minutes = (seconds: number) => formatDuration(seconds);
const zonesWord = (n: number) => `${n} zone${n === 1 ? "" : "s"}`;

type Planner = (
  a: Record<string, unknown>,
  ctx: Ctx,
) => Omit<Extract<Plan, { ok: true }>, "ok">;

const TOOLS: Record<string, Planner> = {
  get_status: () => ({
    tier: "read",
    summary: "status",
    run: (c) => c.request("status", {}),
  }),
  list_zones: () => ({
    tier: "read",
    summary: "zones",
    run: (c) => c.request("zones.list", {}),
  }),
  list_programs: () => ({
    tier: "read",
    summary: "programs",
    run: (c) => c.request("programs.list", {}),
  }),
  stop_zone: (a, ctx) => {
    const z = zoneOf(ctx, a.zone);
    return {
      tier: "stop",
      summary: `Stopped ${z.name}`,
      run: (c) => c.request("zone.stop", { zone: z.zone }),
    };
  },
  stop_all: () => ({
    tier: "stop",
    summary: "Stopped all watering",
    run: (c) => c.request("stop.all", {}),
  }),
  run_zone: (a, ctx) => {
    const z = zoneOf(ctx, a.zone);
    if (!z.enabled) throw bad(`${z.name} is turned off`);
    const seconds = int(a.seconds, "Run time (seconds)", 60, MAX_RUN_MIN * 60);
    return {
      tier: "act",
      water: true,
      summary: `Run ${z.name} for ${minutes(seconds)}`,
      detail: `Valve ${z.valve ?? z.zone}. You can stop it any time.`,
      run: (c) => c.request("zone.run", { zone: z.zone, seconds }),
    };
  },
  set_rain_delay: (a, ctx) => {
    const hours = int(a.hours, "Hours", 0, MAX_DELAY_H);
    const until = Math.floor(ctx.now.getTime() / 1000) + hours * 3600;
    return {
      tier: "act",
      summary: hours === 0 ? "Cancel the rain delay" : `Rain delay, ${hours} h`,
      detail:
        hours === 0
          ? "Programs run as scheduled again."
          : `Programs skip their runs until ${whenLabel(until, ctx.now)}.`,
      run: (c) => c.request("rain.delay", { hours }),
    };
  },
  update_zone: (a, ctx) => {
    const z = zoneOf(ctx, a.zone);
    const patch: Partial<Zone> = {};
    const changes: string[] = [];
    if (a.name !== undefined) {
      if (
        typeof a.name !== "string" ||
        !a.name.trim() ||
        a.name.length > MAX_NAME
      )
        throw bad(`Names are 1 to ${MAX_NAME} characters`);
      patch.name = a.name.trim();
      changes.push(`name → ${patch.name}`);
    }
    if (a.defaultSeconds !== undefined) {
      patch.defaultSeconds = int(
        a.defaultSeconds,
        "Default run time (seconds)",
        60,
        MAX_RUN_MIN * 60,
      );
      changes.push(
        `default ${minutes(z.defaultSeconds)} → ${minutes(patch.defaultSeconds)}`,
      );
    }
    if (a.enabled !== undefined) {
      if (typeof a.enabled !== "boolean")
        throw bad("enabled must be true or false");
      patch.enabled = a.enabled;
      changes.push(a.enabled ? "turn on" : "turn off");
    }
    if (a.valve !== undefined) {
      if (!ctx.canMoveValve)
        throw new Refuse(
          "UNKNOWN_CMD",
          "This controller can't move a zone to another valve",
        );
      const valve = int(a.valve, "Valve", 1, 64);
      const owner = ctx.zones.find(
        (x) => x.valve === valve && x.zone !== z.zone,
      );
      if (owner)
        throw new Refuse(
          "VALVE_IN_USE",
          `Valve ${valve} is used by ${owner.name}`,
        );
      patch.valve = valve;
      changes.push(`valve ${z.valve ?? z.zone} → ${valve}`);
    }
    if (!changes.length) throw bad("Nothing to change");
    return {
      tier: "act",
      summary: `Change ${z.name}`,
      detail: changes.join(" · "),
      run: (c) => c.request("zone.update", { zone: z.zone, ...patch }),
    };
  },
  save_program: (a, ctx) => {
    const p = a as Partial<Program>;
    if (
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > MAX_NAME
    )
      throw bad(`Program names are 1 to ${MAX_NAME} characters`);
    if (
      !Array.isArray(p.days) ||
      p.days.length === 0 ||
      p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      throw bad("Days must be 0 (Sunday) to 6, at least one");
    if (
      typeof p.start !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)
    )
      throw bad("Start must be HH:MM");
    if (
      !Array.isArray(p.steps) ||
      p.steps.length === 0 ||
      p.steps.length > MAX_STEPS
    )
      throw bad(`A program waters 1 to ${MAX_STEPS} zones`);
    const steps = p.steps.map((s) => ({
      zone: zoneOf(ctx, s?.zone).zone,
      seconds: int(s?.seconds, "Step run time (seconds)", 60, MAX_RUN_MIN * 60),
    }));
    const existing =
      p.id !== undefined ? ctx.programs.find((x) => x.id === p.id) : undefined;
    if (p.id !== undefined && !existing)
      throw new Refuse("NOT_FOUND", `There is no program ${p.id}`);
    const program: Program = {
      id: existing?.id,
      name: p.name.trim(),
      enabled: p.enabled ?? true,
      days: [...new Set(p.days)].sort(),
      start: p.start,
      steps,
    };
    const total = steps.reduce((s, x) => s + x.seconds, 0);
    const days = program.days.map((d) => "SMTWTFS"[d]).join(" ");
    const after = `${days} · ${program.start} · ${zonesWord(steps.length)} · ${minutes(total)}`;
    const before = existing
      ? `${existing.days.map((d) => "SMTWTFS"[d]).join(" ")} · ${existing.start} · ${zonesWord(existing.steps.length)}`
      : undefined;
    return {
      tier: "act",
      summary: existing
        ? `Change program ${existing.name}`
        : `New program ${program.name}`,
      detail: before ? `${before} → ${after}` : after,
      run: (c) => c.request("program.save", program),
    };
  },
  delete_program: (a, ctx) => {
    const p = ctx.programs.find((x) => x.id === a.id);
    if (!p)
      throw new Refuse("NOT_FOUND", `There is no program ${String(a.id)}`);
    return {
      tier: "act",
      summary: `Delete program ${p.name}`,
      detail: "The controller stops running it.",
      run: (c) => c.request("program.delete", { id: p.id! }),
    };
  },
};

export function planTool(
  name: string,
  args: Record<string, unknown>,
  ctx: Ctx,
): Plan {
  const planner = Object.prototype.hasOwnProperty.call(TOOLS, name)
    ? TOOLS[name]
    : undefined;
  if (!planner)
    return {
      ok: false,
      code: "UNKNOWN_TOOL",
      message: `The app doesn't allow "${name}"`,
    };
  try {
    return { ok: true, ...planner(args ?? {}, ctx) };
  } catch (e) {
    if (e instanceof Refuse)
      return { ok: false, code: e.code, message: e.message };
    return { ok: false, code: "BAD_REQUEST", message: String(e) };
  }
}

/** Act cards left alone this long expire and report TIMEOUT (docs/assistant.md). */
export const CONFIRM_TIMEOUT_MS = 2 * 60 * 1000;
