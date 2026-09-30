import type { Program } from "../../device/types";

export type TodayRun = {
  program: Program;
  /** "HH:MM", device local time (the phone set it with time.set). */
  start: string;
  seconds: number;
  state: "done" | "now" | "upcoming";
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Enabled programs that run today, in start order, marked done / now / upcoming by the clock. */
export function todayRuns(programs: Program[], now: Date): TodayRun[] {
  const day = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return programs
    .filter((p) => p.enabled && p.days.includes(day))
    .map((program) => {
      const seconds = program.steps.reduce((sum, s) => sum + s.seconds, 0);
      const start = minutesOf(program.start);
      const end = start + seconds / 60;
      const state: TodayRun["state"] =
        nowMin >= end ? "done" : nowMin >= start ? "now" : "upcoming";
      return { program, start: program.start, seconds, state };
    })
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Epoch seconds → "today 18:00", "tomorrow 06:00", "Friday 06:00". */
export function whenLabel(at: number, now: Date): string {
  const d = new Date(at * 1000);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  const day =
    days === 0 ? "today" : days === 1 ? "tomorrow" : WEEKDAYS[d.getDay()];
  return `${day} ${hhmm}`;
}
