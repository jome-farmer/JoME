import type { Usage } from "../../device/types";

/** Phone-local "YYYY-MM-DD" (the board files days in the same local time). */
export function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Every day of the period, oldest first, with 0 where the board logged nothing. */
export function dailyLiters(
  usage: Usage,
  days: number,
  today: Date,
): { date: string; liters: number }[] {
  const logged = new Map(usage.days.map((d) => [d.date, d.liters]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (days - 1 - i),
    );
    const date = isoDay(d);
    return { date, liters: logged.get(date) ?? 0 };
  });
}

export function totals(usage: Usage): { liters: number; seconds: number } {
  return usage.zones.reduce(
    (t, z) => ({ liters: t.liters + z.liters, seconds: t.seconds + z.seconds }),
    { liters: 0, seconds: 0 },
  );
}
