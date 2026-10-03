import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Droplet,
  Droplets,
  FlaskConical,
  Pencil,
  Play,
  Square,
  TestTube,
  Timer,
  type LucideIcon,
} from "lucide-react";
import {
  supports,
  useDeviceClient,
  useOfflineReason,
} from "../../device/hooks";
import { useGarden } from "../../device/useGarden";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import {
  deleteZone,
  runZone,
  stopZone,
  updateZone,
} from "../../store/gardenSlice";
import { errorText } from "../../services/device/errors";
import {
  ecLevel,
  moistureLevel,
  phLevel,
  sampleArea,
  sampleSoil,
  sampleTrend,
} from "../../services/field";
import { formatDuration, formatLiters } from "../../lib/format";
import { remainingFraction } from "../../lib/math";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Sparkline } from "../../ui/Chart";
import { IconButton } from "../../ui/IconButton";
import { List, ListRow } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import { Switch } from "../../ui/Switch";
import { ZoneSheet } from "./ZoneSheet";
import { valveOptions } from "./valves";
import styles from "./ZoneScreen.module.css";

const TABS = ["Overview", "Sensors", "Schedule", "Settings"] as const;
type Tab = (typeof TABS)[number];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One zone up close: live status, readings, today's water, run or stop it. */
export function ZoneScreen() {
  const id = Number(useParams().zone);
  const { state } = useAppSelector(selectDevice);
  const garden = useGarden();
  const zone = garden.zones.find((z) => z.zone === id);

  if (state !== "ready") return <Navigate to="/zones" replace />;
  // Deleted, or not loaded yet: the list knows which.
  if (!zone) return garden.status ? <Navigate to="/zones" replace /> : null;
  return <Detail key={zone.zone} zoneId={zone.zone} />;
}

function Detail({ zoneId }: { zoneId: number }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const client = useDeviceClient();
  const { info } = useAppSelector(selectDevice);
  const garden = useGarden();
  const zone = garden.zones.find((z) => z.zone === zoneId)!;
  const [tab, setTab] = useState<Tab>("Overview");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [today, setToday] = useState<{ liters: number; seconds: number }>();
  const offlineReason = useOfflineReason();
  const change = (go: () => void) => () =>
    offlineReason ? setError(offlineReason) : go();

  const running = garden.run?.zone === zoneId ? garden.run : null;
  const soil = sampleSoil(zoneId);
  const programs = garden.programs.filter((p) =>
    p.steps.some((s) => s.zone === zoneId),
  );

  // Today's water for this zone, from the board's log.
  useEffect(() => {
    if (!client || !supports(info, "usage.read")) return;
    let live = true;
    client.request("usage.read", { days: 1 }).then(
      (u) =>
        live &&
        setToday(
          u.zones.find((z) => z.zone === zoneId) ?? { liters: 0, seconds: 0 },
        ),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [client, info, zoneId, running?.zone]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const back = () =>
    (window.history.state as { idx?: number } | null)?.idx
      ? navigate(-1)
      : navigate("/zones");

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <IconButton
          icon={ArrowLeft}
          label="Back"
          variant="plain"
          className={styles.back}
          onClick={back}
        />
        <div className={styles.titles}>
          <h1 className={styles.title}>{zone.name}</h1>
          <span className={styles.sub}>
            Valve {zone.valve} · {sampleArea(zoneId)} m² (sample)
          </span>
        </div>
        {running ? (
          <StatusPill tone="flow" icon={Droplet}>
            Watering
          </StatusPill>
        ) : zone.enabled ? (
          <StatusPill tone="ok">Active</StatusPill>
        ) : (
          <StatusPill tone="off">Off</StatusPill>
        )}
      </header>

      <img src="/art/crop.svg" alt="" className={styles.art} />

      <div className={styles.body}>
        <Segmented options={TABS} value={tab} onChange={setTab} label="Zone" />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {tab === "Overview" && (
          <>
            <Card className={styles.live}>
              <span className={styles.label}>Live status</span>
              {running ? (
                <>
                  <div className={styles.liveRow}>
                    <Droplet
                      size={32}
                      className={styles.flowIcon}
                      fill="currentColor"
                      aria-hidden
                    />
                    <span className={styles.liveText}>
                      <b>Watering</b>
                      <span className={styles.meta}>
                        {formatDuration(garden.remaining)} left
                      </span>
                    </span>
                    <span className={styles.pct}>
                      {Math.round(
                        (1 -
                          remainingFraction(garden.remaining, running.total)) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <span
                    className={styles.progress}
                    role="progressbar"
                    aria-label="Run progress"
                    aria-valuenow={Math.round(
                      (1 - remainingFraction(garden.remaining, running.total)) *
                        100,
                    )}
                  >
                    <span
                      style={{
                        inlineSize: `${(1 - remainingFraction(garden.remaining, running.total)) * 100}%`,
                      }}
                    />
                  </span>
                </>
              ) : (
                <div className={styles.liveRow}>
                  <span className={styles.liveText}>
                    <b>{zone.enabled ? "Idle" : "Off"}</b>
                    <span className={styles.meta}>
                      {zone.enabled
                        ? `Runs ${formatDuration(zone.defaultSeconds)} when started by hand`
                        : "Programs skip this zone while it's off"}
                    </span>
                  </span>
                </div>
              )}
            </Card>

            <SampleTiles moisture={soil.moisture} ec={soil.ec} ph={soil.ph} />

            <Card className={styles.today}>
              <span className={styles.label}>Today</span>
              <div className={styles.facts}>
                <Fact
                  icon={Droplets}
                  label="Water used"
                  value={today ? formatLiters(today.liters) : "—"}
                />
                <Fact
                  icon={Clock}
                  label="Watering time"
                  value={today ? formatDuration(today.seconds) : "—"}
                />
                <Fact
                  icon={Timer}
                  label="Default run"
                  value={formatDuration(zone.defaultSeconds)}
                />
              </div>
            </Card>

            <div className={styles.actions}>
              <Button
                icon={Play}
                size="lg"
                haptic
                loading={busy && !running}
                disabled={!zone.enabled || !!running}
                aria-disabled={!!offlineReason}
                onClick={change(
                  () =>
                    void act(() =>
                      dispatch(runZone(zoneId, zone.defaultSeconds)),
                    ),
                )}
              >
                Run now
              </Button>
              <Button
                icon={Square}
                size="lg"
                variant="danger"
                haptic
                loading={busy && !!running}
                disabled={!running}
                aria-disabled={!!offlineReason}
                onClick={change(
                  () => void act(() => dispatch(stopZone(zoneId))),
                )}
              >
                Stop
              </Button>
            </div>

            <Card className={styles.auto}>
              <span className={styles.liveText}>
                <b>On schedule</b>
                <span className={styles.meta}>
                  Programs water this zone on their days and times.
                </span>
              </span>
              <Switch
                checked={zone.enabled}
                label="Water this zone on schedule"
                aria-disabled={!!offlineReason}
                onChange={(enabled) =>
                  offlineReason
                    ? setError(offlineReason)
                    : void act(() => dispatch(updateZone(zoneId, { enabled })))
                }
              />
            </Card>
          </>
        )}

        {tab === "Sensors" && (
          <>
            <StatusPill tone="off">Sample data · no probes yet</StatusPill>
            <List>
              <ListRow
                icon={Droplets}
                title="Soil moisture"
                subtitle={`${soil.moisture}% · ${moistureLevel(soil.moisture)}`}
                trailing={
                  <span className={styles.spark}>
                    <Sparkline
                      values={sampleTrend(soil.moisture, zoneId)}
                      tone={
                        moistureLevel(soil.moisture) === "Good" ? "ok" : "warn"
                      }
                    />
                  </span>
                }
              />
              <ListRow
                icon={FlaskConical}
                title="EC"
                subtitle={`${soil.ec} mS/cm · ${ecLevel(soil.ec)}`}
                trailing={
                  <span className={styles.spark}>
                    <Sparkline values={sampleTrend(soil.ec, zoneId)} />
                  </span>
                }
              />
              <ListRow
                icon={TestTube}
                title="pH"
                subtitle={`${soil.ph} · ${phLevel(soil.ph)}`}
                trailing={
                  <span className={styles.spark}>
                    <Sparkline values={sampleTrend(soil.ph, zoneId)} />
                  </span>
                }
              />
            </List>
          </>
        )}

        {tab === "Schedule" &&
          (programs.length === 0 ? (
            <p className={styles.meta}>
              No program waters this zone yet. Add it to one on the Schedule
              tab.
            </p>
          ) : (
            <List>
              {programs.map((p) => {
                const step = p.steps.find((s) => s.zone === zoneId)!;
                return (
                  <ListRow
                    key={p.id}
                    icon={CalendarDays}
                    title={`${p.start} · ${p.name}`}
                    subtitle={`${p.days.map((d) => DAY[d]).join(" ")} · ${formatDuration(step.seconds)}${p.enabled ? "" : " · paused"}`}
                    onClick={() => navigate(`/schedule/${p.id}`)}
                  />
                );
              })}
            </List>
          ))}

        {tab === "Settings" && (
          <List>
            <ListRow
              icon={Pencil}
              title="Name, valve and run time"
              subtitle={`${zone.name} · valve ${zone.valve} · ${formatDuration(zone.defaultSeconds)}`}
              onClick={() => setSheet(true)}
            />
          </List>
        )}
      </div>

      {sheet && (
        <ZoneSheet
          zone={zone}
          running={!!running}
          onClose={() => setSheet(false)}
          onRun={(s) => dispatch(runZone(zoneId, s))}
          onStop={() => dispatch(stopZone(zoneId))}
          onUpdate={(p) => dispatch(updateZone(zoneId, p))}
          onDelete={() => dispatch(deleteZone(zoneId))}
          valves={valveOptions(garden.valveCount, garden.zones, zoneId)}
          canMoveValve={garden.canMoveValve}
        />
      )}
    </main>
  );
}

function SampleTiles({
  moisture,
  ec,
  ph,
}: {
  moisture: number;
  ec: number;
  ph: number;
}) {
  return (
    <div className={styles.tiles} aria-label="Sample readings" role="group">
      <Fact
        icon={Droplets}
        label="Soil moisture"
        value={`${moisture}%`}
        note={moistureLevel(moisture)}
      />
      <Fact icon={FlaskConical} label="EC" value={String(ec)} note="mS/cm" />
      <Fact icon={TestTube} label="pH" value={String(ph)} note={phLevel(ph)} />
      <span className={styles.sampleNote}>Sample readings</span>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={styles.fact}>
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      <span>
        <span className={styles.factLabel}>{label}</span>
        <b className={styles.factValue}>{value}</b>
        {note && <span className={styles.factLabel}>{note}</span>}
      </span>
    </div>
  );
}
