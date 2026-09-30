import styles from "./Onboarding.module.css";

/** First-run progress: Welcome, Connect, Wi‑Fi, Name. */
export function StepDots({
  step,
  total = 4,
}: {
  step: number;
  total?: number;
}) {
  return (
    <div
      className={styles.dots}
      role="img"
      aria-label={`Step ${step + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i === step ? styles.dotOn : undefined} />
      ))}
    </div>
  );
}
