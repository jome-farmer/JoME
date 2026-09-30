import { useState } from "react";
import { CloudRain } from "lucide-react";
import { Button } from "./Button";
import { List, ListRow } from "./ListRow";
import { Sheet } from "./Sheet";
import styles from "./RainDelaySheet.module.css";

const OPTIONS = [24, 48, 72];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Epoch seconds, or null when no delay is set. */
  until: number | null;
  /** Hours to pause programs; 0 cancels the delay. */
  onSet: (hours: number) => Promise<void>;
};

/** Pause every program for a while, e.g. when rain is on the way. Used by Home and Device. */
export function RainDelaySheet({ open, onClose, until, onSet }: Props) {
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState<string>();

  const set = async (hours: number) => {
    setBusy(hours);
    setError(undefined);
    try {
      await onSet(hours);
      onClose();
    } catch (e) {
      setError(
        `Couldn't set the rain delay. ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Rain delay">
      <p className={styles.text}>
        Programs skip their runs until the delay ends. You can still water by
        hand.
      </p>
      <List>
        {OPTIONS.map((h) => (
          <ListRow
            key={h}
            icon={CloudRain}
            title={`Delay ${h} h`}
            trailing={busy === h ? "…" : undefined}
            onClick={() => void set(h)}
          />
        ))}
      </List>
      {until && (
        <Button
          variant="secondary"
          block
          onClick={() => void set(0)}
          loading={busy === 0}
        >
          Cancel rain delay
        </Button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
