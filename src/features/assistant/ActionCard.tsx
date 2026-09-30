import {
  Check,
  CircleSlash,
  Clock,
  Droplet,
  OctagonAlert,
  Square,
  Zap,
} from "lucide-react";
import { Button } from "../../ui/Button";
import type { Part } from "./useChat";
import styles from "./Assistant.module.css";

type Card = Extract<Part, { kind: "card" }>;

const RESULT: Record<
  Exclude<Card["state"], "pending">,
  { icon: typeof Check; text: string }
> = {
  running: { icon: Zap, text: "Working…" },
  done: { icon: Check, text: "Done" },
  declined: { icon: CircleSlash, text: "Declined" },
  failed: { icon: OctagonAlert, text: "Failed" },
  expired: { icon: Clock, text: "Not confirmed in time" },
};

/**
 * Something the assistant wants to change (ADR 0002). Nothing happens until Confirm.
 * Stop cards arrive already running: stopping water is always safe.
 */
export function ActionCard({
  card,
  onConfirm,
  onCancel,
}: {
  card: Card;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const Icon = card.tier === "stop" ? Square : card.water ? Droplet : Zap;
  const result = card.state === "pending" ? undefined : RESULT[card.state];
  const flowing =
    card.water && (card.state === "running" || card.state === "done");

  return (
    <div
      className={`${styles.card} ${styles[card.state]} ${flowing ? styles.flowing : ""}`}
      role={card.state === "pending" ? "group" : "status"}
      aria-label={card.summary}
    >
      <div className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <Icon size={20} aria-hidden />
        </span>
        <div className={styles.cardText}>
          <b>{card.summary}</b>
          {card.detail && <span>{card.detail}</span>}
        </div>
      </div>
      {card.state === "pending" ? (
        <div className={styles.cardActions}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      ) : (
        result && (
          <p className={styles.cardResult}>
            <result.icon size={16} aria-hidden />
            {card.state === "failed" && card.message
              ? `Failed: ${card.message}`
              : result.text}
          </p>
        )
      )}
    </div>
  );
}
