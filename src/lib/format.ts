/** Seconds → "45 s", "7 min", "1 h", "1 h 20 min" (design/README.md#copy). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Litres → "812 L", "4.5 L" under 10, "1,240 L". */
export function formatLiters(liters: number): string {
  const n = liters < 10 ? Math.round(liters * 10) / 10 : Math.round(liters);
  return `${n.toLocaleString("en-US")} L`;
}

/** Board temperature → "28.5 °C", or "— °C" when the sensor has no reading. */
export function formatTemperature(celsius: number | null): string {
  return celsius === null ? "— °C" : `${celsius.toFixed(1)} °C`;
}

/** Flow → "12.4 L/min". */
export function formatFlow(lpm: number): string {
  return `${lpm.toFixed(1)} L/min`;
}

/** Seconds → countdown clock "6:42", or "1:05:00" past an hour. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
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
