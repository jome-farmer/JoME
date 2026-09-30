import type { ValveOption } from "./valves";
import styles from "./ZonesScreen.module.css";

type Props = {
  options: ValveOption[];
  value: number | undefined;
  onChange: (valve: number) => void;
  disabled?: boolean;
};

/** Grid of the controller's valves (mockup 5b): free ones selectable, taken ones show their zone. */
export function ValvePicker({ options, value, onChange, disabled }: Props) {
  return (
    <div className={styles.valves} role="radiogroup" aria-label="Valve">
      {options.map((o) => (
        <button
          key={o.valve}
          type="button"
          role="radio"
          aria-checked={value === o.valve}
          aria-label={
            o.takenBy
              ? `Valve ${o.valve}, used by ${o.takenBy}`
              : `Valve ${o.valve}, free`
          }
          className={`${styles.valve} ${value === o.valve ? styles.valveOn : ""}`}
          disabled={disabled || Boolean(o.takenBy)}
          onClick={() => onChange(o.valve)}
        >
          <b>{o.valve}</b>
          <small>{o.takenBy ?? "Free"}</small>
        </button>
      ))}
    </div>
  );
}
