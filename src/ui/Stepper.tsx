import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { clamp } from "../lib/math";
import styles from "./Stepper.module.css";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Accessible name, e.g. "Duration". */
  label: string;
  format?: (value: number) => string;
};

const HOLD_DELAY = 400;
const HOLD_INTERVAL = 100;

/** − value + with tap-and-hold repeat. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format = String,
}: Props) {
  const latest = useRef(value);
  latest.current = value;
  const timer = useRef<number | undefined>(undefined);
  const repeated = useRef(false);

  const bump = (dir: 1 | -1) => {
    const next = clamp(latest.current + dir * step, min, max);
    // At a limit the button disables, and a disabled button may never get pointerup.
    if (next === latest.current) return stopHold();
    latest.current = next;
    onChange(next);
  };

  function stopHold() {
    clearTimeout(timer.current);
    clearInterval(timer.current);
  }
  useEffect(() => stopHold, []);

  const holdProps = (dir: 1 | -1) => ({
    onPointerDown: () => {
      repeated.current = false;
      timer.current = window.setTimeout(() => {
        repeated.current = true;
        timer.current = window.setInterval(() => bump(dir), HOLD_INTERVAL);
      }, HOLD_DELAY);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    // Click handles taps and keyboard; skip it after a hold already stepped.
    onClick: () => (repeated.current ? (repeated.current = false) : bump(dir)),
  });

  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        {...holdProps(-1)}
      >
        <Minus size={20} aria-hidden />
      </button>
      <output className={styles.value} aria-live="polite">
        {format(value)}
      </output>
      <button
        type="button"
        className={styles.btn}
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        {...holdProps(1)}
      >
        <Plus size={20} aria-hidden />
      </button>
    </div>
  );
}
