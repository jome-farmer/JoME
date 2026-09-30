import { useEffect, useRef, useState } from "react";
import { Bluetooth } from "lucide-react";
import { scanForJoME, type FoundDevice } from "../../device/links/bleLink";
import { List, ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { SignalBars } from "./SignalBars";
import styles from "./Onboarding.module.css";

/**
 * Native only: live BLE scan for JoME boards, strongest signal first. Scans while mounted.
 * `lookFor` (an advertised name from a QR label) picks that board automatically once it's seen.
 */
export function NearbyList({
  onPick,
  lookFor,
}: {
  onPick: (deviceId: string) => void;
  lookFor?: string;
}) {
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [error, setError] = useState<string>();
  const picked = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!lookFor || picked.current === lookFor) return;
    const match = Object.values(found).find((d) => d.name === lookFor);
    if (match) {
      picked.current = lookFor;
      onPick(match.deviceId);
    }
  }, [found, lookFor, onPick]);

  useEffect(() => {
    let stop: (() => Promise<void>) | undefined;
    let unmounted = false;
    scanForJoME((d) => setFound((f) => ({ ...f, [d.deviceId]: d })))
      .then((s) => (unmounted ? void s() : (stop = s)))
      .catch(() =>
        setError(
          "Turn on Bluetooth and allow JoME to use it, then come back to this screen.",
        ),
      );
    return () => {
      unmounted = true;
      void stop?.();
    };
  }, []);

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  const list = Object.values(found).sort(
    (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999),
  );
  return (
    <>
      <StatusPill tone="idle" live>
        Searching
      </StatusPill>
      {list.length > 0 && (
        <List>
          {list.map((d) => (
            <ListRow
              key={d.deviceId}
              icon={Bluetooth}
              title={<span className={styles.mono}>{d.name}</span>}
              trailing={<SignalBars rssi={d.rssi} />}
              onClick={() => onPick(d.deviceId)}
            />
          ))}
        </List>
      )}
    </>
  );
}
