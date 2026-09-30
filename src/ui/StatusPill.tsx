import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./StatusPill.module.css";

type Props = {
  /** flow = water is flowing; never use it for anything else. */
  tone: "flow" | "ok" | "idle" | "off" | "warn" | "danger";
  icon?: LucideIcon;
  /** Shows a pulsing dot instead of an icon, for live states ("Connecting…"). */
  live?: boolean;
  children: ReactNode;
};

/** State is always icon (or dot) + word, never colour alone. */
export function StatusPill({ tone, icon: Icon, live, children }: Props) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      {live ? (
        <span className={styles.dot} aria-hidden />
      ) : (
        Icon && <Icon size={14} strokeWidth={2} aria-hidden />
      )}
      {children}
    </span>
  );
}
