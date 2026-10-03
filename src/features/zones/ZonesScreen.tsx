import { useState } from "react";
import { thump } from "../../lib/haptics";
import { useNavigate } from "react-router-dom";
import { Droplet, Play, Plug, Plus, Square } from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { useGarden } from "../../device/useGarden";
import { createZone, runZone, stopZone } from "../../store/gardenSlice";
import type { Zone } from "../../services/device/types";
import { formatClock, formatDuration, formatFlow } from "../../lib/format";
import { remainingFraction } from "../../lib/math";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { StatusPill } from "../../ui/StatusPill";
import { zoneSummary } from "./summary";
import { AddZoneSheet } from "./AddZoneSheet";
import { valveOptions } from "./valves";
import styles from "./ZonesScreen.module.css";
import { errorText } from "../../services/device/errors";

/** Mockup 5: every zone, what it's doing, one big button to run or stop it. */
export function ZonesScreen() {
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const navigate = useNavigate();

  if (state !== "ready" || !client) {
    return (
      <Screen title="Zones">
        <EmptyState
          title="Your zones will appear here"
          action={
            <Button icon={Plug} onClick={() => navigate("/connect")}>
              Connect a controller
            </Button>
          }
        >
          Run, stop and name up to 16 zones once your JoME is connected.
        </EmptyState>
      </Screen>
    );
  }
  return <Connected />;
}

function Connected() {
  const garden = useGarden();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { zones, run, remaining, sensors } = garden;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState<string>();
  // Offline, changes look disabled and a tap says why instead of opening anything.
  const offlineReason = useOfflineReason();
  const change = (go: () => void) => () =>
    offlineReason ? setError(offlineReason) : go();

  const quick = async (z: Zone) => {
    thump();
    setBusy(z.zone);
    setError(undefined);
    try {
      if (run?.zone === z.zone) await dispatch(stopZone(z.zone));
      else await dispatch(runZone(z.zone, z.defaultSeconds));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  };

  const { valveCount } = garden;
  const loaded = garden.status !== undefined;

  return (
    <Screen title="Zones">
      <p className={styles.summary}>{zoneSummary(zones, run?.zone ?? null)}</p>
      {(error || garden.error) && (
        <p className={styles.error} role="alert">
          {error ?? `Couldn't read zones. ${garden.error}`}
        </p>
      )}

      {loaded && zones.length === 0 && (
        <EmptyState
          title="No zones yet"
          action={
            <Button
              icon={Plus}
              aria-disabled={!!offlineReason}
              onClick={change(() => setAdding(true))}
            >
              Add your first zone
            </Button>
          }
        >
          Each zone is one valve on the controller. Name it after the part of
          the garden it waters.
        </EmptyState>
      )}

      <ul className={styles.list}>
        {zones.map((z) => {
          const running = run?.zone === z.zone;
          const done = running
            ? 1 - remainingFraction(remaining, run.total)
            : 0;
          return (
            <li
              key={z.zone}
              className={`${styles.card} ${z.enabled ? "" : styles.off}`}
            >
              {running && (
                <span
                  className={styles.water}
                  style={{ blockSize: `${Math.round(done * 100)}%` }}
                  aria-hidden
                />
              )}
              <button
                type="button"
                className={styles.open}
                onClick={() => navigate(`/zones/${z.zone}`)}
                aria-label={`${z.name}, valve ${z.valve}. Open zone`}
              >
                <span className={styles.zn}>VALVE {z.valve}</span>
                <span className={styles.name}>{z.name}</span>
                <span className={styles.meta}>
                  {running ? (
                    <>
                      <StatusPill tone="flow" icon={Droplet}>
                        {formatClock(remaining)} left
                      </StatusPill>
                      {sensors?.flowLpm !== undefined &&
                        formatFlow(sensors.flowLpm)}
                    </>
                  ) : garden.wasWatering === z.zone ? (
                    // Offline: what it was doing at the last sync, never live.
                    <StatusPill tone="off" icon={Droplet}>
                      Was watering
                    </StatusPill>
                  ) : z.enabled ? (
                    <>
                      <StatusPill tone="idle">Idle</StatusPill>
                      {formatDuration(z.defaultSeconds)}
                    </>
                  ) : (
                    <StatusPill tone="off">Off</StatusPill>
                  )}
                </span>
              </button>
              {z.enabled && (
                <button
                  type="button"
                  className={`${styles.run} ${running ? styles.stop : ""}`}
                  onClick={change(() => void quick(z))}
                  disabled={busy === z.zone}
                  aria-disabled={!!offlineReason || undefined}
                  aria-label={
                    running
                      ? `Stop ${z.name}`
                      : `Run ${z.name} for ${formatDuration(z.defaultSeconds)}`
                  }
                >
                  {running ? (
                    <Square size={20} fill="currentColor" aria-hidden />
                  ) : (
                    <Play size={20} fill="currentColor" aria-hidden />
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {zones.length > 0 && (
        <button
          type="button"
          className={styles.addZone}
          onClick={change(() => setAdding(true))}
          aria-disabled={!!offlineReason || undefined}
        >
          <Plus size={20} aria-hidden />
          Add zone
        </button>
      )}

      {adding && (
        <AddZoneSheet
          options={valveOptions(valveCount, zones)}
          onClose={() => setAdding(false)}
          onCreate={(z) => dispatch(createZone(z))}
        />
      )}
    </Screen>
  );
}
