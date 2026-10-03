import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { DeviceClient } from "../../services/device/client";
import type { Usage } from "../../services/device/types";
import { formatLiters } from "../../lib/format";
import { BarChart } from "../../ui/Chart";
import styles from "./UsageCard.module.css";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Home's water card: the last 7 days from the board's log, today in pine. Opens Analytics. */
export function UsageCard({ client }: { client: DeviceClient }) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<Usage>();

  useEffect(() => {
    let live = true;
    client.request("usage.read", { days: 7 }).then(
      (u) => live && setUsage(u),
      () => {}, // the card just stays without numbers
    );
    return () => {
      live = false;
    };
  }, [client]);

  const now = new Date();
  const days = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i),
  );
  const liters = days.map(
    (d) => usage?.days.find((u) => u.date === iso(d))?.liters ?? 0,
  );
  const week = liters.reduce((a, b) => a + b, 0);

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => navigate("/analytics")}
    >
      <span className={styles.head}>
        <span className={styles.text}>
          <span className={styles.meta}>
            Water used <small>(7 days)</small>
          </span>
          <b className={styles.total}>{usage ? formatLiters(week) : "—"}</b>
        </span>
        <ChevronRight size={20} aria-hidden className={styles.chev} />
      </span>
      <BarChart
        values={liters}
        labels={days.map((d) => WEEKDAY[d.getDay()])}
        highlight={6}
        height={56}
        label={`Water used per day, last 7 days: ${formatLiters(week)} in all.`}
      />
    </button>
  );
}
