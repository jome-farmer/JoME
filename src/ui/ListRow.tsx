import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import styles from "./ListRow.module.css";

type Props = {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing content: a value, a Switch, signal bars… */
  trailing?: ReactNode;
  /** Makes the row a button and shows a chevron. */
  onClick?: () => void;
  tone?: "default" | "danger";
};

/** Place ListRows inside a <List> so they share one surface and dividers. */
export function ListRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
  onClick,
  tone = "default",
}: Props) {
  const body = (
    <>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {onClick && (
        <ChevronRight className={styles.chev} size={20} aria-hidden />
      )}
    </>
  );
  const cls = [styles.row, tone === "danger" && styles.danger]
    .filter(Boolean)
    .join(" ");
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}
