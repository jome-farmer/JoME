import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CloudSun,
  Droplet,
  Droplets,
  Plug,
  Sprout,
  Square,
  Thermometer,
} from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useGarden } from "../../device/useGarden";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { stopZone } from "../../store/gardenSlice";
import { errorText } from "../../services/device/errors";
import {
  moistureLevel,
  SAMPLE_DEVICES,
  sampleMapShape,
  sampleSoil,
} from "../../services/field";
import { formatDuration, formatTemperature, whenLabel } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Sparkline } from "../../ui/Chart";
import { EmptyState } from "../../ui/EmptyState";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import styles from "./MapScreen.module.css";

const VIEWS = ["Map", "Zones", "Sensors"] as const;
type View = (typeof VIEWS)[number];

/** The garden from above: each zone as a plot, coloured by what it's doing. */
export function MapScreen() {
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const navigate = useNavigate();

  if (state !== "ready" || !client) {
    return (
      <Screen title="Map">
        <EmptyState
          title="Your garden map will appear here"
          action={
            <Button icon={Plug} onClick={() => navigate("/connect")}>
              Connect a controller
            </Button>
          }
        >
          See every zone from above, and which one is watering.
        </EmptyState>
      </Screen>
    );
  }
  return <Connected />;
}

function Connected() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { info } = useAppSelector(selectDevice);
  const garden = useGarden();
  const { zones, run, sensors } = garden;
  const [view, setView] = useState<View>("Map");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const offlineReason = useOfflineReason();
  const running = run ? zones.find((z) => z.zone === run.zone) : undefined;
  const open = (zone: number) => navigate(`/zones/${zone}`);

  const stop = async () => {
    if (offlineReason) return setError(offlineReason);
    if (!run) return;
    setBusy(true);
    setError(undefined);
    try {
      await dispatch(stopZone(run.zone));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={info?.name ?? "Garden"}
      subtitle={`${zones.length} ${zones.length === 1 ? "zone" : "zones"}`}
      actions={
        sensors?.temperatureC !== undefined && (
          <StatusPill tone="idle" icon={Thermometer}>
            {formatTemperature(sensors.temperatureC)}
          </StatusPill>
        )
      }
    >
      <Segmented options={VIEWS} value={view} onChange={setView} label="View" />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {view === "Map" && (
        // The map doesn't mirror in RTL: north-west stays top-left.
        <div className={styles.map} dir="ltr">
          <img src="/art/field.svg" alt="" className={styles.art} />
          <svg viewBox="0 0 100 140" className={styles.plots} aria-hidden>
            {zones.map((z, i) => {
              const tone =
                run?.zone === z.zone
                  ? "flow"
                  : !z.enabled
                    ? "off"
                    : moistureLevel(sampleSoil(z.zone).moisture) === "Low"
                      ? "warn"
                      : "ok";
              return (
                <polygon
                  key={z.zone}
                  points={sampleMapShape(i, zones.length)}
                  className={styles[tone]}
                />
              );
            })}
          </svg>
          {zones.map((z, i) => {
            const [x, y] = centre(sampleMapShape(i, zones.length));
            const watering = run?.zone === z.zone;
            const moisture = sampleSoil(z.zone).moisture;
            return (
              <button
                key={z.zone}
                type="button"
                className={`${styles.chip} ${watering ? styles.chipFlow : ""}`}
                style={{
                  insetInlineStart: `${x}%`,
                  insetBlockStart: `${(y / 140) * 100}%`,
                }}
                onClick={() => open(z.zone)}
              >
                <b>{z.name}</b>
                <span>
                  {watering ? (
                    <>
                      <Droplet size={12} aria-hidden /> Watering
                    </>
                  ) : !z.enabled ? (
                    "Off"
                  ) : (
                    <>
                      <Droplets size={12} aria-hidden /> {moisture}%{" "}
                      {moistureLevel(moisture) === "Low" ? "· Low" : ""}
                    </>
                  )}
                </span>
              </button>
            );
          })}
          <span className={styles.sample}>Sample layout · moisture</span>
        </div>
      )}

      {view === "Zones" && (
        <List>
          {zones.map((z) => {
            const moisture = sampleSoil(z.zone).moisture;
            return (
              <ListRow
                key={z.zone}
                icon={Sprout}
                title={z.name}
                subtitle={
                  run?.zone === z.zone
                    ? `Watering · ${formatDuration(garden.remaining)} left`
                    : z.enabled
                      ? `Idle · soil ${moisture}% (sample)`
                      : "Off"
                }
                onClick={() => open(z.zone)}
              />
            );
          })}
        </List>
      )}

      {view === "Sensors" && (
        <>
          <StatusPill tone="off">Sample data · no sensors yet</StatusPill>
          <List>
            {SAMPLE_DEVICES.filter(
              (d) => d.kind === "Sensors" || d.kind === "Weather",
            ).map((d) => (
              <ListRow
                key={d.id}
                icon={d.kind === "Weather" ? CloudSun : Droplets}
                title={d.name}
                subtitle={`${d.where} · ${d.reading}`}
                trailing={
                  d.trend && (
                    <span className={styles.spark}>
                      <Sparkline
                        values={d.trend}
                        tone={d.low ? "warn" : "ok"}
                      />
                    </span>
                  )
                }
              />
            ))}
          </List>
        </>
      )}

      <Card className={styles.now}>
        {running && run ? (
          <>
            <Droplet
              size={28}
              fill="currentColor"
              className={styles.flowIcon}
              aria-hidden
            />
            <span className={styles.nowText}>
              <b>{running.name}</b>
              <span className={styles.flowText}>Watering</span>
              <span className={styles.meta}>
                {formatDuration(garden.remaining)} left
              </span>
            </span>
            <Button
              variant="secondary"
              icon={Square}
              haptic
              loading={busy}
              aria-disabled={!!offlineReason}
              onClick={() => void stop()}
            >
              Stop
            </Button>
          </>
        ) : (
          <span className={styles.nowText}>
            <b>Nothing watering</b>
            <span className={styles.meta}>
              {garden.status?.nextRun
                ? `Next: ${garden.status.nextRun.name}, ${whenLabel(garden.status.nextRun.at, new Date(garden.now))}`
                : "No program scheduled"}
            </span>
          </span>
        )}
      </Card>
    </Screen>
  );
}

/** Average of a polygon's corners, in its own units. */
function centre(points: string): [number, number] {
  const xy = points.split(" ").map((p) => p.split(",").map(Number));
  return [
    xy.reduce((a, [x]) => a + x, 0) / xy.length,
    xy.reduce((a, [, y]) => a + y, 0) / xy.length,
  ];
}
