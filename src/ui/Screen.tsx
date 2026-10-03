import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "./IconButton";
import styles from "./Screen.module.css";

type Props = {
  title: string;
  /** Small label above the title, e.g. "Good evening". */
  eyebrow?: string;
  /** Header actions on the inline-end side, e.g. an IconButton. */
  actions?: ReactNode;
  /** A line under the title, e.g. "8 zones". */
  subtitle?: ReactNode;
  /** Shows a back arrow before the title (screens below a tab). */
  onBack?: () => void;
  children: ReactNode;
};

/** Standard screen: safe-area aware gutter, title row, content stack. */
export function Screen({
  title,
  eyebrow,
  actions,
  subtitle,
  onBack,
  children,
}: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        {onBack && (
          <IconButton
            icon={ArrowLeft}
            label="Back"
            variant="plain"
            className={styles.back}
            onClick={onBack}
          />
        )}
        <div className={styles.titles}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}
