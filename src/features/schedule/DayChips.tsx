import { DAYS } from "./program";
import styles from "./Schedule.module.css";

type Props = {
  days: number[];
  /** Without onToggle the chips are read-only (program cards). */
  onToggle?: (day: number) => void;
};

/** S M T W T F S. Filled chips are the days the program runs. */
export function DayChips({ days, onToggle }: Props) {
  if (!onToggle) {
    const on = DAYS.filter((d) => days.includes(d.day)).map((d) => d.long);
    return (
      <div
        className={styles.days}
        role="img"
        aria-label={on.join(", ") || "No days"}
      >
        {DAYS.map((d) => (
          <i
            key={d.day}
            className={days.includes(d.day) ? styles.dayOn : undefined}
          >
            {d.short}
          </i>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.days} role="group" aria-label="Days">
      {DAYS.map((d) => (
        <button
          key={d.day}
          type="button"
          className={`${styles.dayBtn} ${days.includes(d.day) ? styles.dayOn : ""}`}
          aria-pressed={days.includes(d.day)}
          aria-label={d.long}
          onClick={() => onToggle(d.day)}
        >
          {d.short}
        </button>
      ))}
    </div>
  );
}
