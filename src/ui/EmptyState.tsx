import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  title: string;
  children?: ReactNode;
  /** One action, usually a <Button>. */
  action?: ReactNode;
};

export function EmptyState({ title, children, action }: Props) {
  return (
    <div className={styles.empty}>
      <img className={styles.mascot} src="/logo/symbol.svg" alt="" />
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  );
}
