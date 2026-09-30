import { useEffect, useState } from "react";
import { Bluetooth } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import {
  canScanInApp,
  isBleAvailable,
  pickJoME,
  scanForJoME,
  type FoundDevice,
} from "../../device/links/bleLink";
import { Button } from "../../ui/Button";
import { List, ListRow } from "../../ui/ListRow";
import { Sheet } from "../../ui/Sheet";
import { StatusPill } from "../../ui/StatusPill";

// ponytail: minimal entry point until the onboarding Connect screen (#15) replaces it.
export function BleConnect() {
  const { connectBle, state } = useDevice();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  if (!isBleAvailable()) return null;

  const start = async () => {
    setError(undefined);
    if (canScanInApp()) return setOpen(true);
    try {
      const d = await pickJoME(); // Browser chooser; must run inside the click.
      await connectBle(d.deviceId);
    } catch (e) {
      // Closing the chooser is not an error worth showing.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) setError(`Couldn't open Bluetooth. ${msg}`);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        icon={Bluetooth}
        onClick={start}
        loading={state === "connecting" && !open}
      >
        Connect with Bluetooth
      </Button>
      {error && <p role="alert">{error}</p>}
      {canScanInApp() && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title="Nearby controllers"
        >
          {open && (
            <ScanList
              onPick={(id) => {
                setOpen(false);
                void connectBle(id);
              }}
            />
          )}
        </Sheet>
      )}
    </>
  );
}

function ScanList({ onPick }: { onPick: (deviceId: string) => void }) {
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stop: (() => Promise<void>) | undefined;
    let cancelled = false;
    scanForJoME((d) => setFound((f) => ({ ...f, [d.deviceId]: d })))
      .then((s) => (cancelled ? void s() : (stop = s)))
      .catch(() =>
        setError("Turn on Bluetooth and allow JoME to use it, then try again."),
      );
    return () => {
      cancelled = true;
      void stop?.();
    };
  }, []);

  const list = Object.values(found).sort(
    (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999),
  );
  if (error) return <p role="alert">{error}</p>;
  return (
    <>
      <StatusPill tone="idle" live>
        Searching… hold your phone near the controller
      </StatusPill>
      {list.length > 0 && (
        <List>
          {list.map((d) => (
            <ListRow
              key={d.deviceId}
              icon={Bluetooth}
              title={d.name}
              subtitle={signal(d.rssi)}
              onClick={() => onPick(d.deviceId)}
            />
          ))}
        </List>
      )}
    </>
  );
}

const signal = (rssi?: number) =>
  rssi === undefined
    ? ""
    : rssi > -60
      ? "Strong signal"
      : rssi > -75
        ? "Good signal"
        : "Weak signal";
