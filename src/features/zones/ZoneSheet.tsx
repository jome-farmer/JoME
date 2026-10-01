import { useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { useOfflineReason } from "../../device/DeviceContext";
import type { Zone } from "../../device/types";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { Stepper } from "../../ui/Stepper";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { ValvePicker } from "./ValvePicker";
import type { ValveOption } from "./valves";
import styles from "./ZonesScreen.module.css";
import { errorText } from "../../device/errors";

const MAX_MIN = 60; // App-side limit, same as the assistant's (docs/assistant.md).
const MAX_NAME = 32;

type Props = {
  zone: Zone;
  running: boolean;
  onClose: () => void;
  onRun: (seconds: number) => Promise<void>;
  onStop: () => Promise<void>;
  onUpdate: (patch: Partial<Omit<Zone, "zone">>) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Valves for the picker; this zone's own valve counts as free. */
  valves: ValveOption[];
  /** Fixed-zone boards (firmware v1) can't move a zone to another valve. */
  canMoveValve: boolean;
};

/** Everything about one zone: run it for a chosen time, turn it on/off, rename, set its default. */
export function ZoneSheet({
  zone,
  running,
  onClose,
  onRun,
  onStop,
  onUpdate,
  onDelete,
  valves,
  canMoveValve,
}: Props) {
  const [minutes, setMinutes] = useState(
    Math.min(MAX_MIN, Math.max(1, Math.round(zone.defaultSeconds / 60))),
  );
  const [name, setName] = useState(zone.name);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [pickValve, setPickValve] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Offline: changes look disabled. Those that go to the board are refused there and say why;
  // these openers say it here instead of opening.
  const offlineReason = useOfflineReason();
  const blocked = !!offlineReason;
  const change = (go: () => void) => () =>
    offlineReason ? setError(offlineReason) : go();

  const act = async (what: string, fn: () => Promise<void>, close = false) => {
    setBusy(what);
    setError(undefined);
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  };

  const trimmed = name.trim();
  const isDefault = minutes * 60 === zone.defaultSeconds;

  return (
    <Sheet open onClose={onClose} title={zone.name}>
      {running ? (
        <Button
          variant="danger"
          size="lg"
          block
          icon={Square}
          aria-disabled={blocked}
          loading={busy === "stop"}
          onClick={() => void act("stop", onStop, true)}
        >
          Stop watering
        </Button>
      ) : (
        <>
          <Stepper
            label="Run time"
            value={minutes}
            onChange={setMinutes}
            min={1}
            max={MAX_MIN}
            format={(m) => formatDuration(m * 60)}
          />
          <Button
            size="lg"
            block
            icon={Play}
            disabled={!zone.enabled}
            aria-disabled={blocked}
            loading={busy === "run"}
            onClick={() => void act("run", () => onRun(minutes * 60), true)}
          >
            Run {formatDuration(minutes * 60)}
          </Button>
          {!isDefault && (
            <Button
              variant="ghost"
              block
              aria-disabled={blocked}
              loading={busy === "default"}
              onClick={() =>
                void act("default", () =>
                  onUpdate({ defaultSeconds: minutes * 60 }),
                )
              }
            >
              Make {formatDuration(minutes * 60)} the default
            </Button>
          )}
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.settingRow}>
        <span>
          <b>Zone on</b>
          <span className={styles.muted}>
            Turned-off zones skip programs and can't be run.
          </span>
        </span>
        <Switch
          checked={zone.enabled}
          label="Zone on"
          aria-disabled={blocked}
          onChange={(enabled) =>
            void act("enabled", () => onUpdate({ enabled }))
          }
        />
      </div>

      <form
        className={styles.rename}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && trimmed !== zone.name)
            void act("name", () => onUpdate({ name: trimmed }));
        }}
      >
        <TextField
          id={`zone-${zone.zone}-name`}
          label="Name"
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          enterKeyHint="done"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!trimmed || trimmed === zone.name}
          aria-disabled={blocked}
          loading={busy === "name"}
        >
          Save name
        </Button>
      </form>

      <div className={styles.fieldGroup}>
        <div className={styles.settingRow}>
          <span>
            <b>Valve {zone.valve ?? zone.zone}</b>
            <span className={styles.muted}>
              The terminal on the controller this zone is wired to.
            </span>
          </span>
          {canMoveValve && (
            <Button
              variant="secondary"
              aria-disabled={blocked}
              onClick={change(() => setPickValve((p) => !p))}
            >
              {pickValve ? "Done" : "Change"}
            </Button>
          )}
        </div>
        {pickValve && (
          <ValvePicker
            options={valves}
            value={zone.valve}
            disabled={busy === "valve"}
            onChange={(valve) =>
              valve !== zone.valve &&
              void act("valve", () => onUpdate({ valve }))
            }
          />
        )}
      </div>

      {confirmDelete ? (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-label="Delete zone"
        >
          <p>
            <b>Delete {zone.name}?</b> Programs stop watering it, and valve{" "}
            {zone.valve} becomes free.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={busy === "delete"}
              onClick={() => void act("delete", onDelete, true)}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          icon={Trash2}
          aria-disabled={blocked}
          onClick={change(() => setConfirmDelete(true))}
        >
          Delete zone
        </Button>
      )}
    </Sheet>
  );
}
