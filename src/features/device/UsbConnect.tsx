import { useState } from "react";
import { Cable } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import {
  isAndroidUsbAvailable,
  listUsbSerial,
} from "../../device/links/androidUsbLink";
import {
  isWebSerialAvailable,
  pickSerialPort,
} from "../../device/links/webSerialLink";
import { Button } from "../../ui/Button";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ponytail: minimal entry point until the onboarding Connect screen (#15) replaces it.
// Takes the first adapter on Android; a picker arrives with #15 if people plug in several.
export function UsbConnect() {
  const { connectWebSerial, connectAndroidUsb } = useDevice();
  const [error, setError] = useState<string>();

  // Hidden on iOS: it can't talk to USB‑TTL adapters (ADR 0001).
  if (!isWebSerialAvailable() && !isAndroidUsbAvailable()) return null;

  const start = async () => {
    setError(undefined);
    try {
      if (isAndroidUsbAvailable()) {
        const [first] = await listUsbSerial();
        if (!first) {
          setError(
            "No USB adapter found. Plug the controller in with a USB OTG cable, then try again.",
          );
          return;
        }
        await connectAndroidUsb(first.deviceId);
        return;
      }
      const port = await pickSerialPort(); // Browser chooser; must run inside the click.
      await connectWebSerial(port);
    } catch (e) {
      // Closing the browser chooser without picking a port is not an error.
      if (e instanceof DOMException && e.name === "NotFoundError") return;
      setError(`Couldn't open the USB port. ${message(e)}`);
    }
  };

  return (
    <>
      <Button variant="secondary" icon={Cable} onClick={start}>
        Connect with USB cable
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
