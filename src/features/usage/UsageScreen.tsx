import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { errorText } from "../../device/errors";
import type { Usage, Zone } from "../../device/types";
import { formatDuration, formatLiters } from "../../lib/format";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { dailyLiters, totals } from "./usage";
import styles from "./UsageScreen.module.css";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Water use from the board's log (design/README.md screen 12). */
export function UsageScreen() {
  const navigate = useNavigate();
  const { client } = useDevice();
  const [period, setPeriod] = useState<Period>(7);
  const [usage, setUsage] = useState<Usage>();
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!client) return;
    let live = true;
    setUsage(undefined);
    setError(undefined);
    Promise.all([
      client.request("usage.read", { days: period }),
      client.request("zones.list", {}),
    ]).then(
      ([u, z]) => {
        if (!live) return;
        setUsage(u);
        setZones(z.zones);
      },
      (e: unknown) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [client, period]);

  const days = usage ? dailyLiters(usage, period, new Date()) : [];
  const max = Math.max(1, ...days.map((d) => d.liters));
  const sum = usage ? totals(usage) : { liters: 0, seconds: 0 };
  const peak = days.reduce((a, b) => (b.liters > a.liters ? b : a), {
    date: "",
    liters: 0,
  });
  const zoneName = (id: number) =>
    zones.find((z) => z.zone === id)?.name ?? `Zone ${id} (removed)`;

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <IconButton
          icon={ArrowLeft}
          label="Back"
          onClick={() => navigate(-1)}
        />
        <h1 className={styles.title}>Water use</h1>
        <span />
      </header>

      <div className={styles.periods} role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className={p === period ? styles.on : undefined}
            aria-pressed={p === period}
            onClick={() => setPeriod(p)}
          >
            {p} days
          </button>
        ))}
      </div>

      {!client ? (
        <p className={styles.note}>
          Connect to your JoME to see its water log.
        </p>
      ) : error ? (
        <p className={styles.error} role="alert">
          Couldn&apos;t read the water log. {error}
        </p>
      ) : !usage ? (
        <p className={styles.note}>Reading the controller&apos;s log…</p>
      ) : sum.liters === 0 && sum.seconds === 0 ? (
        <EmptyState title="No water logged yet">
          The controller logs every run it waters, with the litres from its flow
          sensor. Runs in the last {period} days will show up here.
        </EmptyState>
      ) : (
        <>
          <Card className={styles.summary}>
            <b className={styles.total}>{formatLiters(sum.liters)}</b>
            <span className={styles.meta}>
              in the last {period} days · watered {formatDuration(sum.seconds)}
            </span>
            <div
              className={styles.chart}
              role="img"
              aria-label={`Water per day, last ${period} days. Most: ${formatLiters(peak.liters)} on ${peak.date}.`}
              style={{ ["--bars" as string]: period }}
            >
              {days.map((d) => (
                <span
                  key={d.date}
                  className={styles.bar}
                  style={{ blockSize: `${(d.liters / max) * 100}%` }}
                  title={`${d.date}: ${formatLiters(d.liters)}`}
                />
              ))}
            </div>
            {period === 7 ? (
              <div className={styles.axis7} aria-hidden>
                {days.map((d) => (
                  <span key={d.date}>
                    {WEEKDAY[new Date(`${d.date}T12:00`).getDay()]}
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.axis} aria-hidden>
                <span>{days[0]?.date}</span>
                <span>Today</span>
              </div>
            )}
          </Card>

          <section className={styles.section}>
            <h2 className={styles.label}>By zone</h2>
            <Card className={styles.zones}>
              {usage.zones
                .slice()
                .sort((a, b) => b.liters - a.liters)
                .map((z) => (
                  <div key={z.zone} className={styles.zone}>
                    <span className={styles.zoneName}>{zoneName(z.zone)}</span>
                    <span className={styles.zoneLiters}>
                      {formatLiters(z.liters)}
                    </span>
                    <span
                      className={styles.share}
                      style={{
                        inlineSize: `${sum.liters ? (z.liters / sum.liters) * 100 : 0}%`,
                      }}
                      aria-hidden
                    />
                    <span className={styles.meta}>
                      {formatDuration(z.seconds)} watering
                    </span>
                  </div>
                ))}
            </Card>
          </section>
        </>
      )}
    </main>
  );
}
