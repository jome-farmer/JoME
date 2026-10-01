import styles from "./Switch.module.css";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Morning program". */
  label: string;
  disabled?: boolean;
  /** Looks disabled but still calls onChange, so the screen can explain why. */
  "aria-disabled"?: boolean;
};

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  "aria-disabled": ariaDisabled,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      aria-disabled={ariaDisabled || undefined}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    />
  );
}
