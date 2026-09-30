import type { ReactNode } from "react";
import styles from "./Screen.module.css";

type Props = {
  title: string;
  /** Small label above the title, e.g. "Good evening". */
  eyebrow?: string;
  /** Header actions on the inline-end side, e.g. an IconButton. */
  actions?: ReactNode;
  children: ReactNode;
};

/** Standard screen: safe-area aware gutter, title row, content stack. */
export function Screen({ title, eyebrow, actions, children }: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}
