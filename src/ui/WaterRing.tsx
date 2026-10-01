import { formatClock, formatDuration } from "../lib/format";
import { remainingFraction } from "../lib/math";
import styles from "./WaterRing.module.css";

type Props = {
  /** Seconds left in the run. */
  remaining: number;
  /** Seconds the run was started with. */
  total: number;
  size?: number;
};

const R = 52;
const C = 2 * Math.PI * R;

/** Signature element: time left on the running zone, drawn in water blue. */
export function WaterRing({ remaining, total, size = 132 }: Props) {
  const offset = C * (1 - remainingFraction(remaining, total));
  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label="Watering time left"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.max(0, Math.round(remaining))}
      aria-valuetext={`${formatDuration(remaining)} left`}
    >
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className={styles.track} cx="60" cy="60" r={R} />
        <circle
          className={styles.progress}
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.center} aria-hidden>
        <b>{formatClock(remaining)}</b>
        <span>min left</span>
      </div>
    </div>
  );
}
