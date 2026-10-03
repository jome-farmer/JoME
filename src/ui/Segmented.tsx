import styles from "./Segmented.module.css";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Section". */
  label: string;
};

/** A row of pills that picks one view: Map · Zones · Sensors. The chosen one is filled pine. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: Props<T>) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={o === value ? styles.on : undefined}
          aria-pressed={o === value}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
