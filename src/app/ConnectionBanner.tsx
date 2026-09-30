import type { ReactNode } from "react";
import { useDevice } from "../device/DeviceContext";
import styles from "./ConnectionBanner.module.css";

/** Slim bar above every tab: connecting, lost, failed, or demo. Never a modal. */
export function ConnectionBanner() {
  const { state, linkKind, info, error, retry, disconnect } = useDevice();
  const name = info?.name ?? "JoME";

  if (state === "connecting") {
    return (
      <Bar tone="warn" live>
        Connecting to {name}…
      </Bar>
    );
  }
  if (state === "lost" || (state === "idle" && error)) {
    return (
      <Bar tone="danger" action={{ label: "Retry", onClick: retry }}>
        {state === "lost" && linkKind === "ble"
          ? `Connection to ${name} lost. Reconnecting…`
          : (error ?? `Connection to ${name} lost.`)}
      </Bar>
    );
  }
  if (state === "ready" && linkKind === "mock") {
    return (
      <Bar
        tone="idle"
        action={{
          label: "Exit demo",
          onClick: () => disconnect({ forget: true }),
        }}
      >
        Demo mode · simulated controller
      </Bar>
    );
  }
  return null;
}

function Bar({
  tone,
  live,
  action,
  children,
}: {
  tone: "warn" | "danger" | "idle";
  live?: boolean;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <div
      data-banner
      className={`${styles.bar} ${styles[tone]}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {live && <span className={styles.dot} aria-hidden />}
      <span className={styles.text}>{children}</span>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
