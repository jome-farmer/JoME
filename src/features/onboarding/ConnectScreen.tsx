import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bluetooth, Cable, FlaskConical } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import {
  canScanInApp,
  isBleAvailable,
  pickJoME,
} from "../../device/links/bleLink";
import {
  isAndroidUsbAvailable,
  listUsbSerial,
} from "../../device/links/androidUsbLink";
import {
  isWebSerialAvailable,
  pickSerialPort,
} from "../../device/links/webSerialLink";
import { IconButton } from "../../ui/IconButton";
import { List, ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { NearbyList } from "./NearbyList";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** The user closed a browser chooser: not an error. */
const cancelled = (e: unknown) =>
  (e instanceof DOMException && e.name === "NotFoundError") ||
  /cancel/i.test(message(e));

export function ConnectScreen() {
  const navigate = useNavigate();
  const device = useDevice();
  const [error, setError] = useState<string>();
  // Only react to connections started here, not one that was already up.
  const started = useRef(false);

  useEffect(() => {
    // ponytail: goes straight Home; the Wi‑Fi and Name steps slot in here with #17.
    if (started.current && device.state === "ready")
      navigate("/", { replace: true });
  }, [device.state, navigate]);

  const connect = (run: () => Promise<void>) => {
    started.current = true;
    setError(undefined);
    void run();
  };

  // Browser choosers must open inside the click handler.
  const pickBluetooth = async () => {
    try {
      const d = await pickJoME();
      connect(() => device.connectBle(d.deviceId));
    } catch (e) {
      if (!cancelled(e)) setError(`Couldn't open Bluetooth. ${message(e)}`);
    }
  };
  const useCable = async () => {
    try {
      if (isAndroidUsbAvailable()) {
        const [first] = await listUsbSerial();
        if (!first) {
          setError(
            "No USB adapter found. Plug the controller in with a USB OTG cable, then try again.",
          );
          return;
        }
        // ponytail: first adapter only; add a picker if people plug in several.
        connect(() => device.connectAndroidUsb(first.deviceId));
      } else {
        const port = await pickSerialPort();
        connect(() => device.connectWebSerial(port));
      }
    } catch (e) {
      if (!cancelled(e)) setError(`Couldn't open the USB port. ${message(e)}`);
    }
  };

  const connecting = device.state === "connecting";
  const failed =
    started.current && device.state === "idle" ? device.error : undefined;
  const usb = isAndroidUsbAvailable() || isWebSerialAvailable();

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <IconButton
          icon={ArrowLeft}
          label="Back"
          onClick={() => navigate(-1)}
        />
        <StepDots step={1} />
        <span className={styles.spacer} />
      </div>
      <div>
        <h1 className={styles.title}>Connect your JoME</h1>
        <p className={styles.sub}>
          Hold your phone within a few metres of the controller.
        </p>
      </div>

      {connecting && (
        <div className={styles.notice} role="status">
          <StatusPill tone="warn" live>
            Connecting…
          </StatusPill>
          <p>
            If your phone asks for a pairing code, type the 6 digits printed on
            the controller's label.
          </p>
        </div>
      )}
      {(error || failed) && (
        <p className={styles.error} role="alert">
          {error ?? failed}
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.label}>Nearby</h2>
        {canScanInApp() ? (
          <NearbyList onPick={(id) => connect(() => device.connectBle(id))} />
        ) : isBleAvailable() ? (
          <List>
            <ListRow
              icon={Bluetooth}
              title="Choose a Bluetooth device"
              subtitle="Your browser lists nearby JoME controllers"
              onClick={pickBluetooth}
            />
          </List>
        ) : (
          <p className={styles.sub}>
            This browser can't use Bluetooth. Use Chrome or Edge on a computer,
            or the JoME app on your phone.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.label}>Other ways</h2>
        <List>
          {usb && (
            <ListRow
              icon={Cable}
              title="Use a USB cable"
              subtitle={
                isAndroidUsbAvailable()
                  ? "USB OTG cable from your phone to the controller"
                  : "USB‑TTL adapter on the controller"
              }
              onClick={useCable}
            />
          )}
          <ListRow
            icon={FlaskConical}
            title="Try the demo"
            subtitle="A simulated controller, no hardware needed"
            onClick={() => connect(device.connectDemo)}
          />
        </List>
      </section>
    </main>
  );
}
