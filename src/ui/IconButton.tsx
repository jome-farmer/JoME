import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./IconButton.module.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  variant?: "raised" | "plain";
};

export function IconButton({
  icon: Icon,
  label,
  variant = "raised",
  className,
  ...rest
}: Props) {
  return (
    // type="button": icon buttons never submit a form they sit in.
    <button
      type="button"
      className={[styles.btn, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
