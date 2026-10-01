import { tick } from "../lib/haptics";
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
      data-tap
      onClick={() => {
        // Only a real change ticks; a looks-disabled switch just explains itself.
        if (!ariaDisabled) tick();
        onChange(!checked);
      }}
    />
  );
}
