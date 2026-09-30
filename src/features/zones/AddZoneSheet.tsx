import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Zone } from "../../device/types";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { Stepper } from "../../ui/Stepper";
import { TextField } from "../../ui/TextField";
import { ValvePicker } from "./ValvePicker";
import { firstFreeValve, type ValveOption } from "./valves";
import styles from "./ZonesScreen.module.css";

type Props = {
  options: ValveOption[];
  onClose: () => void;
  onCreate: (zone: Omit<Zone, "zone" | "enabled">) => Promise<unknown>;
};

/** Mockup 5b: name the zone, pick the valve it's wired to, set its usual run time. */
export function AddZoneSheet({ options, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [valve, setValve] = useState(() => firstFreeValve(options));
  const [minutes, setMinutes] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const trimmed = name.trim();
  const full = firstFreeValve(options) === undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || valve === undefined) return;
    setSaving(true);
    setError(undefined);
    try {
      await onCreate({ name: trimmed, valve, defaultSeconds: minutes * 60 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Add a zone">
      {full ? (
        <p className={styles.muted}>
          All {options.length} valves are in use. Delete a zone to free its
          valve.
        </p>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <TextField
            id="new-zone-name"
            label="Name"
            placeholder="Rose bed"
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
          />
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Valve</span>
            <ValvePicker options={options} value={valve} onChange={setValve} />
            <span className={styles.muted}>
              Valves are the numbered terminals on the controller. Each valve
              can belong to one zone.
            </span>
          </div>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Default run time</span>
            <Stepper
              label="Default run time"
              value={minutes}
              onChange={setMinutes}
              min={1}
              max={60}
              format={(m) => formatDuration(m * 60)}
            />
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            block
            icon={Plus}
            disabled={!trimmed || valve === undefined}
            loading={saving}
          >
            Add zone
          </Button>
        </form>
      )}
    </Sheet>
  );
}
