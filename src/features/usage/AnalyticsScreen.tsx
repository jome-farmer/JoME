import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Leaf } from "lucide-react";
import { supports, useDeviceClient } from "../../device/hooks";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { errorText } from "../../services/device/errors";
import type { Usage, Zone } from "../../services/device/types";
import { sampleArea, sampleDaily } from "../../services/field";
import { formatDuration, formatLiters } from "../../lib/format";
import { shapeArea } from "../../lib/geo";
import { getZoneShapes, type ZoneShapes } from "../../lib/storage";
import { Card } from "../../ui/Card";
import { BarChart, Donut } from "../../ui/Chart";
import { chartColor } from "../../lib/theme";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import { dailyLiters, previousLiters, totals } from "./usage";
import styles from "./AnalyticsScreen.module.css";

const VIEWS = ["Water", "Soil", "Nutrients", "Weather"] as const;
type View = (typeof VIEWS)[number];
const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** The board keeps 90 days, so only 7 and 30 have a period before them to compare with. */
const LOG_DAYS = 90;

/** Water from the board's own log; soil, nutrients and weather as samples until those sensors exist. */
export function AnalyticsScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("Water");
  const [period, setPeriod] = useState<Period>(7);

  return (
    <Screen
      title="Analytics"
      onBack={() => navigate("/more")}
      actions={
        <select
          className={styles.period}
          value={period}
          aria-label="Period"
          onChange={(e) => setPeriod(Number(e.target.value) as Period)}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              Last {p} days
            </option>
          ))}
        </select>
      }
    >
      <Segmented options={VIEWS} value={view} onChange={setView} label="Show" />
      {view === "Water" ? (
        <Water period={period} />
      ) : (
        <Sampled view={view} period={period} />
      )}
    </Screen>
  );
}

function Water({ period }: { period: Period }) {
  const client = useDeviceClient();
  const { info } = useAppSelector(selectDevice);
  const [usage, setUsage] = useState<Usage>();
  const [previous, setPrevious] = useState<number>();
  const [zones, setZones] = useState<Zone[]>([]);
  const [shapes, setShapes] = useState<ZoneShapes>({});
  const [error, setError] = useState<string>();
  const canRead = supports(info, "usage.read");

  useEffect(() => {
    if (info) void getZoneShapes(info.serial).then(setShapes);
  }, [info]);

  useEffect(() => {
    if (!client || !canRead) return;
    let live = true;
    setUsage(undefined);
    setPrevious(undefined);
    setError(undefined);
    const compare = period * 2 <= LOG_DAYS;
    Promise.all([
      client.request("usage.read", { days: period }),
      client.request("zones.list", {}),
      compare
        ? client.request("usage.read", { days: period * 2 })
        : Promise.resolve(undefined),
    ]).then(
      ([u, z, both]) => {
        if (!live) return;
        setUsage(u);
        setZones(z.zones);
        setPrevious(both && previousLiters(both, period, new Date()));
      },
      (e: unknown) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [client, canRead, period]);

  if (!client)
    return (
      <p className={styles.note}>Connect to your JoME to see its water log.</p>
    );
  if (!canRead)
    return (
      <p className={styles.note}>
        This controller&apos;s firmware doesn&apos;t keep a water log yet.
      </p>
    );
  if (error)
    return (
      <p className={styles.error} role="alert">
        Couldn&apos;t read the water log. {error}
      </p>
    );
  if (!usage)
    return <p className={styles.note}>Reading the controller&apos;s log…</p>;

  const sum = totals(usage);
  if (sum.liters === 0 && sum.seconds === 0)
    return (
      <EmptyState title="No water logged yet">
        The controller logs every run it waters, with the litres from its flow
        sensor. Runs in the last {period} days will show up here.
      </EmptyState>
    );

  const days = dailyLiters(usage, period, new Date());
  const delta =
    previous === undefined
      ? undefined
      : Math.round(((sum.liters - previous) / previous) * 100);
  const byZone = usage.zones.slice().sort((a, b) => b.liters - a.liters);
  const zoneName = (id: number) =>
    zones.find((z) => z.zone === id)?.name ?? `Zone ${id} (removed)`;
  // Real areas once every watered zone is drawn on the map; samples until then.
  const measured = byZone.every((z) => shapes[z.zone]);
  const area = byZone.reduce(
    (a, z) => a + (measured ? shapeArea(shapes[z.zone]) : sampleArea(z.zone)),
    0,
  );

  return (
    <>
      <Card className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Total water use</span>
          {delta !== undefined && (
            <StatusPill
              tone="ok"
              icon={delta <= 0 ? ArrowDown : ArrowUp}
            >{`${Math.abs(delta)}%`}</StatusPill>
          )}
        </div>
        <b className={styles.total}>{formatLiters(sum.liters)}</b>
        <span className={styles.meta}>
          {delta !== undefined
            ? `Compared with the ${period} days before · `
            : ""}
          watered {formatDuration(sum.seconds)}
        </span>
        <BarChart
          values={days.map((d) => d.liters)}
          labels={
            period === 7
              ? days.map((d) => WEEKDAY[new Date(`${d.date}T12:00`).getDay()])
              : []
          }
          highlight={days.length - 1}
          height={120}
          label={`Water per day, last ${period} days, ${formatLiters(sum.liters)} in all.`}
        />
        {period !== 7 && (
          <div className={styles.axis} aria-hidden>
            <span>{days[0]?.date}</span>
            <span>Today</span>
          </div>
        )}
      </Card>

      <Card className={styles.card}>
        <span className={styles.cardTitle}>Use by zone</span>
        <div className={styles.split}>
          <Donut
            parts={byZone.map((z) => z.liters)}
            center={formatLiters(sum.liters)}
            label={`Water by zone: ${byZone.map((z) => `${zoneName(z.zone)} ${formatLiters(z.liters)}`).join(", ")}`}
          />
          <ul className={styles.legend}>
            {byZone.map((z, i) => (
              <li key={z.zone}>
                <i style={{ background: chartColor(i) }} aria-hidden />
                <span>{zoneName(z.zone)}</span>
                <b>
                  {sum.liters ? Math.round((z.liters / sum.liters) * 100) : 0}%
                </b>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className={styles.efficiency}>
        <Leaf size={32} strokeWidth={1.5} aria-hidden />
        <span className={styles.effText}>
          <span className={styles.cardTitle}>Efficiency</span>
          <b>{(sum.liters / Math.max(1, area)).toFixed(1)} L/m²</b>
          <span className={styles.meta}>
            {measured
              ? "Water per area of the zones you drew"
              : "Water per area · draw every zone on the map for real areas"}
          </span>
        </span>
      </Card>
    </>
  );
}

const SAMPLES: Record<
  Exclude<View, "Water">,
  { title: string; unit: string; base: number; swing: number }[]
> = {
  Soil: [
    { title: "Soil moisture", unit: "%", base: 60, swing: 9 },
    { title: "EC", unit: "mS/cm", base: 1.8, swing: 0.3 },
  ],
  Nutrients: [{ title: "Fertiliser dosed", unit: "ml", base: 320, swing: 90 }],
  Weather: [
    { title: "Temperature", unit: "°C", base: 26, swing: 4 },
    { title: "Rain", unit: "mm", base: 1.2, swing: 2 },
  ],
};

function Sampled({
  view,
  period,
}: {
  view: Exclude<View, "Water">;
  period: Period;
}) {
  return (
    <>
      <StatusPill tone="off">
        Sample data · no {view.toLowerCase()} sensors yet
      </StatusPill>
      {SAMPLES[view].map((s) => {
        const values = sampleDaily(period, s.base, s.swing);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return (
          <Card key={s.title} className={styles.card}>
            <span className={styles.cardTitle}>{s.title}</span>
            <b className={styles.total}>
              {avg.toFixed(1)} {s.unit}
            </b>
            <span className={styles.meta}>Average, last {period} days</span>
            <BarChart
              values={values}
              labels={[]}
              height={96}
              label={`${s.title} per day, sample data.`}
            />
          </Card>
        );
      })}
    </>
  );
}
