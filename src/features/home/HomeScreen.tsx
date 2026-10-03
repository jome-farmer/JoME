import { useState } from "react";
import { thump } from "../../lib/haptics";
import { useNavigate } from "react-router-dom";
import {
  Bluetooth,
  Cable,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Cloud,
  CloudOff,
  CloudRain,
  Droplet,
  Droplets,
  FlaskConical,
  TestTube,
  Play,
  Plug,
  Square,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import {
  supports,
  useDeviceClient,
  useOfflineReason,
} from "../../device/hooks";
import { useAppDispatch, useAppSelector } from "../../store";
import { connectDemo, selectDevice } from "../../store/deviceSlice";
import type { LinkKind } from "../../services/device/links/link";
import {
  formatDuration,
  formatFlow,
  formatTemperature,
  whenLabel,
} from "../../lib/format";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import {
  ecLevel,
  moistureLevel,
  phLevel,
  sampleSoil,
  type Level,
} from "../../services/field";
import { StatusPill } from "../../ui/StatusPill";
import { WaterRing } from "../../ui/WaterRing";
import { RainDelaySheet } from "../../ui/RainDelaySheet";
import { greeting, todayRuns } from "./today";
import { WeatherCard } from "./WeatherCard";
import { UsageCard } from "./UsageCard";
import { useGarden } from "../../device/useGarden";
import { refreshGarden } from "../../store/gardenSlice";
import styles from "./HomeScreen.module.css";
import { errorText } from "../../services/device/errors";

const LINK: Record<LinkKind, { label: string; icon: LucideIcon }> = {
  ble: { label: "Bluetooth", icon: Bluetooth },
  usb: { label: "USB", icon: Cable },
  mock: { label: "Demo", icon: FlaskConical },
  cloud: { label: "Internet", icon: Cloud },
};

/** Status first (design/README.md screen 5): what's watering, what runs next, what ran today. */
export function HomeScreen() {
  const { state, info, linkKind } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (state !== "ready" || !info || !client || !linkKind) {
    return (
      <Screen title="Home">
        <EmptyState
          title="No controller connected"
          action={
            <div className={styles.actions}>
              <Button icon={Plug} onClick={() => navigate("/connect")}>
                Connect a controller
              </Button>
              <Button
                variant="ghost"
                icon={Play}
                onClick={() => void dispatch(connectDemo())}
                loading={state === "connecting"}
              >
                Try the demo
              </Button>
            </div>
          }
        >
          Pair your JoME over Bluetooth or a USB cable, or explore with the
          simulated demo controller.
        </EmptyState>
      </Screen>
    );
  }

  return <Connected name={info.name} linkKind={linkKind} />;
}

function Connected({ name, linkKind }: { name: string; linkKind: LinkKind }) {
  const { info, offline } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const navigate = useNavigate();
  const {
    status,
    zones,
    programs,
    run,
    wasWatering,
    remaining,
    now,
    sensors,
    error,
  } = useGarden();
  const dispatch = useAppDispatch();
  const [rainOpen, setRainOpen] = useState(false);
  const [busy, setBusy] = useState<"stop" | "stopAll">();
  const [actionError, setActionError] = useState<string>();
  const temperature = sensors?.temperatureC;
  // Offline, changes look disabled and a tap says why instead of opening anything.
  const offlineReason = useOfflineReason();
  const change = (open: () => void) => () =>
    offlineReason ? setActionError(offlineReason) : open();

  const date = new Date(now);
  const today = todayRuns(programs, date);
  const zoneName = (zone: number) =>
    zones.find((z) => z.zone === zone)?.name ?? `Zone ${zone}`;
  const rainUntil =
    status?.rainDelayUntil && status.rainDelayUntil * 1000 > now
      ? status.rainDelayUntil
      : null;
  const startedBy = run?.program
    ? programs.find((p) => p.id === run.program)?.name
    : undefined;

  const act = async (kind: "stop" | "stopAll") => {
    if (!client) return;
    thump();
    setBusy(kind);
    setActionError(undefined);
    try {
      if (kind === "stop" && run)
        await client.request("zone.stop", { zone: run.zone });
      else await client.request("stop.all", {});
    } catch (e) {
      setActionError(`Couldn't stop the water. ${errorText(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const Link = LINK[linkKind];

  const soil = sampleSoil();

  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <img src="/art/garden.svg" alt="" className={styles.art} />
        <div className={styles.top}>
          <div className={styles.greet}>
            <span className={styles.eyebrow}>{greeting(date.getHours())}</span>
            <h1 className={styles.title}>{name}</h1>
            <span className={styles.pills}>
              {temperature !== undefined && (
                <span
                  aria-label={
                    temperature === null
                      ? "Board temperature unavailable"
                      : `Board temperature ${formatTemperature(temperature)}`
                  }
                >
                  <StatusPill tone="idle" icon={Thermometer}>
                    {formatTemperature(temperature)}
                  </StatusPill>
                </span>
              )}
              {offline ? (
                <StatusPill tone="danger" icon={CloudOff}>
                  Offline
                </StatusPill>
              ) : (
                <StatusPill tone="ok" icon={Link.icon}>
                  {Link.label}
                </StatusPill>
              )}
            </span>
          </div>
          <button
            type="button"
            className={styles.ask}
            aria-label="Ask JoME"
            onClick={() => navigate("/assistant")}
          >
            <img src="/logo/symbol.svg" alt="" />
          </button>
        </div>
        {/* Sample until the garden has soil probes (services/field.ts). */}
        <div className={styles.tiles}>
          <span className={styles.sample}>Sample sensor data</span>
          <SoilTile
            icon={Droplets}
            label="Soil moisture"
            value={`${soil.moisture}%`}
            level={moistureLevel(soil.moisture)}
          />
          <SoilTile
            icon={FlaskConical}
            label="EC"
            value={String(soil.ec)}
            unit="mS/cm"
            level={ecLevel(soil.ec)}
          />
          <SoilTile
            icon={TestTube}
            label="pH"
            value={String(soil.ph)}
            level={phLevel(soil.ph)}
          />
        </div>
      </section>

      <div className={styles.body}>
        {(error || actionError) && (
          <p className={styles.error} role="alert">
            {actionError ?? `Couldn't read JoME's status. ${error}`}
          </p>
        )}

        <Card className={styles.status}>
          {run ? (
            <>
              <div className={styles.heroRow}>
                <WaterRing remaining={remaining} total={run.total} />
                <div className={styles.heroText}>
                  <StatusPill tone="flow" icon={Droplet}>
                    Watering
                  </StatusPill>
                  <b className={styles.big}>{zoneName(run.zone)}</b>
                  <span className={styles.meta}>
                    Zone {run.zone} ·{" "}
                    {startedBy
                      ? `${startedBy} · step ${run.step ?? "?"}`
                      : "Started by hand"}
                  </span>
                  {sensors?.flowLpm !== undefined && (
                    <span
                      className={`${styles.flowRate} ${sensors.flowLpm > 0 ? styles.flowing : ""}`}
                    >
                      {formatFlow(sensors.flowLpm)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="danger"
                icon={Square}
                block
                loading={busy === "stop"}
                onClick={() => void act("stop")}
              >
                Stop watering
              </Button>
            </>
          ) : wasWatering !== undefined ? (
            // From the cloud copy: what it was doing at the last sync, never a live countdown.
            <>
              <StatusPill tone="off" icon={Droplet}>
                Was watering
              </StatusPill>
              <b className={styles.big}>{zoneName(wasWatering)}</b>
              <span className={styles.meta}>
                Zone {wasWatering}
                {offline?.syncedAt
                  ? ` · at the last sync, ${whenLabel(offline.syncedAt, date)}`
                  : ""}
              </span>
            </>
          ) : rainUntil ? (
            <>
              <StatusPill tone="warn" icon={CloudRain}>
                Rain delay
              </StatusPill>
              <b className={styles.big}>
                Paused until {whenLabel(rainUntil, date)}
              </b>
              <span className={styles.meta}>
                Programs skip their runs until then.
              </span>
              <Button
                variant="secondary"
                aria-disabled={!!offlineReason}
                onClick={change(() => setRainOpen(true))}
              >
                Change or cancel
              </Button>
            </>
          ) : status?.nextRun ? (
            <button
              type="button"
              className={styles.next}
              onClick={() => navigate("/schedule")}
            >
              <span className={styles.nextIcon}>
                <CalendarClock size={24} strokeWidth={1.75} aria-hidden />
              </span>
              <span className={styles.heroText}>
                <span className={styles.meta}>Next irrigation</span>
                <b className={styles.big}>
                  {capitalize(whenLabel(status.nextRun.at, date))}
                </b>
                <span className={styles.meta}>
                  {status.nextRun.name} · in{" "}
                  {formatDuration(status.nextRun.at - now / 1000)}
                </span>
              </span>
              <span className={styles.nextEnd}>
                <StatusPill tone="ok">Auto</StatusPill>
                <ChevronRight size={20} aria-hidden className={styles.chev} />
              </span>
            </button>
          ) : status ? (
            <>
              <StatusPill tone="idle">Idle</StatusPill>
              <b className={styles.big}>Nothing scheduled</b>
              <span className={styles.meta}>
                Add a program and JoME waters on its own.
              </span>
              <Button
                variant="secondary"
                icon={CalendarPlus}
                aria-disabled={!!offlineReason}
                onClick={change(() => navigate("/schedule"))}
              >
                Create a program
              </Button>
            </>
          ) : (
            <StatusPill tone="idle" live>
              Checking JoME…
            </StatusPill>
          )}
        </Card>

        <div className={styles.quick}>
          <QuickAction
            icon={Play}
            label="Run a zone"
            blocked={!!offlineReason}
            onClick={change(() => navigate("/zones"))}
          />
          <QuickAction
            icon={CloudRain}
            tone="warn"
            label="Rain delay"
            blocked={!!offlineReason}
            onClick={change(() => setRainOpen(true))}
            disabled={!supports(info, "rain.delay")}
          />
          <QuickAction
            icon={Square}
            tone="danger"
            label="Stop all"
            onClick={() => void act("stopAll")}
            disabled={!run || busy === "stopAll"}
          />
        </div>

        {client && supports(info, "usage.read") && (
          <UsageCard client={client} />
        )}

        {info && <WeatherCard serial={info.serial} />}

        <section className={styles.section}>
          <h2 className={styles.label}>Today</h2>
          {today.length === 0 ? (
            <p className={styles.meta}>No programs run today.</p>
          ) : (
            <ol className={styles.timeline}>
              {today.map((r) => {
                const flowing =
                  r.state === "now" &&
                  run &&
                  r.program.steps.some((s) => s.zone === run.zone);
                return (
                  <li
                    key={r.program.id ?? r.program.name}
                    className={styles[r.state]}
                  >
                    <time className={styles.time}>{r.start}</time>
                    <span
                      className={`${styles.node} ${flowing ? styles.flowing : ""}`}
                      aria-hidden
                    />
                    <span className={styles.what}>
                      <b>{r.program.name}</b> ·{" "}
                      {r.program.steps.length === 1
                        ? zoneName(r.program.steps[0].zone)
                        : `${r.program.steps.length} zones`}
                    </span>
                    <span className={styles.when}>
                      {r.state === "now"
                        ? "Now"
                        : r.state === "done"
                          ? "Done"
                          : formatDuration(r.seconds)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {client && (
          <RainDelaySheet
            open={rainOpen}
            onClose={() => setRainOpen(false)}
            until={rainUntil}
            onSet={async (hours) => {
              // The sheet lives in ui/ and can't see device errors, so hand it plain words.
              await client
                .request("rain.delay", { hours })
                .catch((e: unknown) => {
                  throw new Error(errorText(e));
                });
              await dispatch(refreshGarden());
            }}
          />
        )}
      </div>
    </main>
  );
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A glass reading over the hero picture: icon, value, and its level in words. */
function SoilTile({
  icon: Icon,
  label,
  value,
  unit,
  level,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  level: Level;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>
        <Icon size={18} strokeWidth={2} aria-hidden />
        <b>{value}</b>
      </span>
      {unit && <span className={styles.tileUnit}>{unit}</span>}
      <span className={styles.tileLevel}>{level}</span>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  tone,
  disabled,
  blocked,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "warn" | "danger";
  disabled?: boolean;
  /** Looks disabled but stays tappable, so the screen can say why. */
  blocked?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.qa} ${tone ? styles[tone] : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={blocked || undefined}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
