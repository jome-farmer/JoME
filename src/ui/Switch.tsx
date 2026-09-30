import styles from "./Switch.module.css";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Morning program". */
  label: string;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    />
  );
}
