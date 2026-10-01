import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Droplets } from "lucide-react";
import type { DeviceClient } from "../../services/device/client";
import type { Usage } from "../../services/device/types";
import { formatLiters } from "../../lib/format";
import styles from "./UsageCard.module.css";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Home's link to the water log: today and the last 7 days. */
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

  const week = usage?.days.reduce((sum, d) => sum + d.liters, 0);
  const today = usage?.days.find((d) => d.date === todayIso())?.liters ?? 0;

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => navigate("/usage")}
    >
      <Droplets size={22} strokeWidth={1.75} aria-hidden />
      <span className={styles.text}>
        <b>Water used</b>
        <span className={styles.meta}>
          {week === undefined
            ? "See how much each zone uses"
            : `Today ${formatLiters(today)} · 7 days ${formatLiters(week)}`}
        </span>
      </span>
      <ChevronRight size={20} aria-hidden />
    </button>
  );
}
