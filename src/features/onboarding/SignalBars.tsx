import { signalLevel } from "./signal";
import styles from "./Onboarding.module.css";

const WORDS = [
  "",
  "Weak signal",
  "Fair signal",
  "Good signal",
  "Strong signal",
];

export function SignalBars({ rssi }: { rssi?: number }) {
  const level = signalLevel(rssi);
  return (
    <span className={styles.bars} role="img" aria-label={WORDS[level]}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className={n <= level ? styles.barOn : undefined} />
      ))}
    </span>
  );
}
