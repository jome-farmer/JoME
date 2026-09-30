import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** The one raised hero surface of a screen: larger radius and padding. */
  hero?: boolean;
};

export function Card({ hero = false, className, ...rest }: Props) {
  return (
    <div
      className={[styles.card, hero && styles.hero, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
