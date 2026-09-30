import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    // type="button" unless told otherwise: a bare <button> in a <form> would submit it.
    <button
      type="button"
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* The label stays in place while loading so the button keeps its width. */}
      <span className={styles.label} data-hidden={loading || undefined}>
        {Icon && <Icon size={20} strokeWidth={1.75} aria-hidden />}
        {children}
      </span>
      {loading && <span className={styles.spinner} aria-hidden />}
    </button>
  );
}
