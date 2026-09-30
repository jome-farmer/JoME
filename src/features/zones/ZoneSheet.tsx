import { useState } from "react";
import { Play, Square } from "lucide-react";
import type { Zone } from "../../device/types";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { Stepper } from "../../ui/Stepper";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import styles from "./ZonesScreen.module.css";

const MAX_MIN = 60; // App-side limit, same as the assistant's (docs/assistant.md).
const MAX_NAME = 32;

type Props = {
  zone: Zone;
  running: boolean;
  onClose: () => void;
  onRun: (seconds: number) => Promise<void>;
  onStop: () => Promise<void>;
  onUpdate: (patch: Partial<Omit<Zone, "zone">>) => Promise<void>;
};

/** Everything about one zone: run it for a chosen time, turn it on/off, rename, set its default. */
export function ZoneSheet({
  zone,
  running,
  onClose,
  onRun,
  onStop,
  onUpdate,
}: Props) {
  const [minutes, setMinutes] = useState(
    Math.min(MAX_MIN, Math.max(1, Math.round(zone.defaultSeconds / 60))),
  );
  const [name, setName] = useState(zone.name);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const act = async (what: string, fn: () => Promise<void>, close = false) => {
    setBusy(what);
    setError(undefined);
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
            loading={busy === "run"}
            onClick={() => void act("run", () => onRun(minutes * 60), true)}
          >
            Run {formatDuration(minutes * 60)}
          </Button>
          {!isDefault && (
            <Button
              variant="ghost"
              block
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
          loading={busy === "name"}
        >
          Save name
        </Button>
      </form>
    </Sheet>
  );
}
