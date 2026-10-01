import { useEffect, useState, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import { disconnect, retry, selectDevice } from "../store/deviceSlice";
import { agoLabel } from "../lib/format";
import styles from "./ConnectionBanner.module.css";

/** Slim bar above every tab: connecting, lost, failed, offline, or demo. Never a modal. */
export function ConnectionBanner() {
  const { state, linkKind, info, error, offline } =
    useAppSelector(selectDevice);
  const dispatch = useAppDispatch();
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
      <Bar
        tone="danger"
        action={{ label: "Retry", onClick: () => void dispatch(retry()) }}
      >
        {state === "lost" && linkKind === "ble"
          ? `Connection to ${name} lost. Reconnecting…`
          : (error ?? `Connection to ${name} lost.`)}
      </Bar>
    );
  }
  if (state === "ready" && offline) {
    return <Offline name={name} syncedAt={offline.syncedAt} />;
  }
  if (state === "ready" && linkKind === "mock") {
    return (
      <Bar
        tone="idle"
        action={{
          label: "Exit demo",
          onClick: () => void dispatch(disconnect({ forget: true })),
        }}
      >
        Demo mode · simulated controller
      </Bar>
    );
  }
  return null;
}

/** Neutral, never red or water blue: the garden keeps running on its schedule (design: Board offline). */
function Offline({ name, syncedAt }: { name: string; syncedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Bar tone="idle">
      {name} is offline
      {syncedAt ? ` · Last synced ${agoLabel(syncedAt, now)}` : ""}
    </Bar>
  );
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
