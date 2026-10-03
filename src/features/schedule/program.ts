import type { Program, Zone } from "../../services/device/types";

export const MAX_STEPS = 16; // Same limit as the assistant's save_program (docs/assistant.md).
export const MAX_STEP_MIN = 60;
export const MAX_NAME = 32;

/** Display order of day chips; values are protocol days (0 = Sunday … 6 = Saturday). */
export const DAYS = [
  { day: 0, short: "S", long: "Sunday" },
  { day: 1, short: "M", long: "Monday" },
  { day: 2, short: "T", long: "Tuesday" },
  { day: 3, short: "W", long: "Wednesday" },
  { day: 4, short: "T", long: "Thursday" },
  { day: 5, short: "F", long: "Friday" },
  { day: 6, short: "S", long: "Saturday" },
];

export const totalSeconds = (p: Pick<Program, "steps">) =>
  p.steps.reduce((sum, s) => sum + s.seconds, 0);

/** What's wrong with a program before it's sent to the board, in plain words. Empty when it's fine. */
export function programProblems(p: Program, zones: Zone[]): string[] {
  const problems: string[] = [];
  const name = p.name.trim();
  if (!name) problems.push("Give the program a name.");
  else if (name.length > MAX_NAME)
    problems.push(`Names are at most ${MAX_NAME} characters.`);
  if (p.days.length === 0) problems.push("Pick at least one day.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start))
    problems.push("Pick a start time.");
  if (p.steps.length === 0) problems.push("Add at least one zone to water.");
  if (p.steps.length > MAX_STEPS)
    problems.push(`A program can water at most ${MAX_STEPS} zones.`);
  if (p.steps.some((s) => s.seconds < 60 || s.seconds > MAX_STEP_MIN * 60))
    problems.push(`Each zone runs 1 to ${MAX_STEP_MIN} minutes.`);
  if (p.steps.some((s) => !zones.some((z) => z.zone === s.zone)))
    problems.push("A zone in this program no longer exists. Remove it.");
  return problems;
}

/** "Front lawn → Backyard hedge", or "3 zones" when the chain gets long. */
export function stepsLabel(p: Pick<Program, "steps">, zones: Zone[]): string {
  const names = p.steps.map(
    (s) => zones.find((z) => z.zone === s.zone)?.name ?? "Deleted zone",
  );
  return names.length <= 3 ? names.join(" → ") : `${names.length} zones`;
}

/** A fresh program: tomorrow-ready defaults the user adjusts. */
export function newProgram(zones: Zone[]): Program {
  const first = zones.find((z) => z.enabled);
  return {
    name: "",
    enabled: true,
    days: [1, 3, 5],
    start: "06:00",
    steps: first ? [{ zone: first.zone, seconds: first.defaultSeconds }] : [],
  };
}

/** Move step i by delta (−1 up, +1 down), clamped to the list. */
export function moveStep<T>(steps: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= steps.length) return steps;
  const next = steps.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export type PlanRow = {
  program: Program;
  step: number;
  zone: number;
  /** "HH:MM" this step starts, the program start plus the steps before it. */
  start: string;
  seconds: number;
  state: "done" | "now" | "next" | "paused";
};

/**
 * What runs on `day`, one row per zone step, by start time. Past steps are
 * done, the running step (from the board's report) is now, paused programs
 * stay listed so people see them.
 */
export function dayPlan(
  programs: Program[],
  day: Date,
  now: Date,
  running?: { program?: number; zone: number } | null,
): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const p of programs) {
    if (!p.days.includes(day.getDay())) continue;
    const [h, m] = p.start.split(":").map(Number);
    let at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    p.steps.forEach((s, i) => {
      const end = new Date(at.getTime() + s.seconds * 1000);
      const state = !p.enabled
        ? "paused"
        : running?.program === p.id && running?.zone === s.zone
          ? "now"
          : end <= now
            ? "done"
            : "next";
      rows.push({
        program: p,
        step: i,
        zone: s.zone,
        start: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
        seconds: s.seconds,
        state,
      });
      at = end;
    });
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}

/** Monday to Sunday of the week `day` is in. */
export function weekOf(day: Date): Date[] {
  const monday = day.getDate() - ((day.getDay() + 6) % 7);
  return Array.from(
    { length: 7 },
    (_, i) => new Date(day.getFullYear(), day.getMonth(), monday + i),
  );
}
