import { useState } from "react";
import { Cable } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import {
  isWebSerialAvailable,
  pickSerialPort,
} from "../../device/links/webSerialLink";
import { Button } from "../../ui/Button";

// ponytail: minimal entry point until the onboarding Connect screen (#15) replaces it.
export function UsbConnect() {
  const { connectWebSerial } = useDevice();
  const [error, setError] = useState<string>();

  if (!isWebSerialAvailable()) return null;

  const start = async () => {
    setError(undefined);
    try {
      const port = await pickSerialPort(); // Browser chooser; must run inside the click.
      await connectWebSerial(port);
    } catch (e) {
      // Closing the chooser without picking a port is not an error.
      if (e instanceof DOMException && e.name === "NotFoundError") return;
      setError(
        `Couldn't open the USB port. ${e instanceof Error ? e.message : String(e)}`,
      );
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
