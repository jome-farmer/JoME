import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Droplet, Play, Plug, Plus, Square } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { useGarden } from "../../device/useGarden";
import type { Zone } from "../../device/types";
import { formatClock, formatDuration } from "../../lib/format";
import { remainingFraction } from "../../lib/math";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { StatusPill } from "../../ui/StatusPill";
import { zoneSummary } from "./summary";
import { AddZoneSheet } from "./AddZoneSheet";
import { valveCountOf, valveOptions } from "./valves";
import { ZoneSheet } from "./ZoneSheet";
import styles from "./ZonesScreen.module.css";

/** Mockup 5: every zone, what it's doing, one big button to run or stop it. */
export function ZonesScreen() {
  const { state, client } = useDevice();
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
  const { client, info } = useDevice();
  const garden = useGarden(client);
  const { zones, run, remaining } = garden;
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState<string>();

  const quick = async (z: Zone) => {
    setBusy(z.zone);
    setError(undefined);
    try {
      if (run?.zone === z.zone) await garden.stopZone(z.zone);
      else await garden.runZone(z.zone, z.defaultSeconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(undefined);
    }
  };

  const sheetZone = zones.find((z) => z.zone === open);
  const valveCount = valveCountOf(info?.valveCount, zones);
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
            <Button icon={Plus} onClick={() => setAdding(true)}>
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
                onClick={() => setOpen(z.zone)}
                aria-label={`${z.name}, valve ${z.valve}. Open settings`}
              >
                <span className={styles.zn}>VALVE {z.valve}</span>
                <span className={styles.name}>{z.name}</span>
                <span className={styles.meta}>
                  {running ? (
                    <StatusPill tone="flow" icon={Droplet}>
                      {formatClock(remaining)} left
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
                  onClick={() => void quick(z)}
                  disabled={busy === z.zone}
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
          onClick={() => setAdding(true)}
        >
          <Plus size={20} aria-hidden />
          Add zone
        </button>
      )}

      {adding && (
        <AddZoneSheet
          options={valveOptions(valveCount, zones)}
          onClose={() => setAdding(false)}
          onCreate={garden.createZone}
        />
      )}

      {sheetZone && (
        <ZoneSheet
          key={sheetZone.zone}
          zone={sheetZone}
          running={run?.zone === sheetZone.zone}
          onClose={() => setOpen(null)}
          onRun={(s) => garden.runZone(sheetZone.zone, s)}
          onStop={() => garden.stopZone(sheetZone.zone)}
          onUpdate={(p) => garden.updateZone(sheetZone.zone, p)}
          onDelete={() => garden.deleteZone(sheetZone.zone)}
          valves={valveOptions(valveCount, zones, sheetZone.zone)}
        />
      )}
    </Screen>
  );
}
