import { chartColor } from "../lib/theme";
import styles from "./Chart.module.css";

/**
 * Bars of past values (water used, readings). Green, never water blue:
 * past use isn't water flowing now. `highlight` marks one bar (today).
 */
export function BarChart({
  values,
  labels,
  label,
  highlight,
  height = 96,
}: {
  values: number[];
  /** One per bar, or empty to hide the axis. */
  labels: string[];
  /** Accessible summary of the chart. */
  label: string;
  highlight?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className={styles.bars}>
      <div
        className={styles.plot}
        role="img"
        aria-label={label}
        style={{ blockSize: height, ["--bars" as string]: values.length }}
      >
        {values.map((v, i) => (
          <span
            key={i}
            className={i === highlight ? styles.hi : undefined}
            style={{ blockSize: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      {labels.length > 0 && (
        <div className={styles.axis} aria-hidden>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A tiny trend line for a reading. Neutral by default; `tone` picks warn for a low value. */
export function Sparkline({
  values,
  tone = "ok",
}: {
  values: number[];
  tone?: "ok" | "warn";
}) {
  const min = Math.min(...values);
  const span = Math.max(1e-9, Math.max(...values) - min);
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`,
    )
    .join(" ");
  return (
    <svg
      className={`${styles.spark} ${styles[tone]}`}
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={points} />
    </svg>
  );
}

/** Shares of a whole (water by zone), with the total in the middle. Colours are --chart-1…6. */
export function Donut({
  parts,
  center,
  label,
}: {
  parts: number[];
  center: string;
  label: string;
}) {
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  const r = 15.915; // circumference 100, so dash lengths are percentages
  let offset = 25; // start at 12 o'clock
  return (
    <svg
      className={styles.donut}
      viewBox="0 0 42 42"
      role="img"
      aria-label={label}
    >
      <circle cx="21" cy="21" r={r} className={styles.track} />
      {parts.map((p, i) => {
        const pct = (p / total) * 100;
        const el = (
          <circle
            key={i}
            cx="21"
            cy="21"
            r={r}
            stroke={chartColor(i)}
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={offset}
          />
        );
        offset -= pct;
        return el;
      })}
      <text x="21" y="21">
        {center}
      </text>
    </svg>
  );
}
