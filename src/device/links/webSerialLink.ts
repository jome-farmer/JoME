import type { Link } from "../link";

/** jome-farmer/protocol §1: the board UART runs 115200 8N1 by default. */
export const DEFAULT_BAUD = 115_200;

/** Desktop Chrome and Edge. Not on phones or in Firefox/Safari. */
export const isWebSerialAvailable = () =>
  typeof navigator !== "undefined" && "serial" in navigator;

/** Opens the browser's port chooser. Needs a user gesture. */
export function pickSerialPort(): Promise<SerialPort> {
  // No vendor filter: USB‑TTL adapters come from many vendors (CH340, CP210x, FTDI, PL2303…).
  return navigator.serial.requestPort();
}

/**
 * A Link over a USB‑TTL serial port.
 * ponytail: opening the port may reset ESP32 dev boards (DTR/RTS auto-reset) like any serial monitor;
 * the 5 s hello timeout covers the reboot. Add setSignals() control if a board needs it.
 */
export function createWebSerialLink(
  port: SerialPort,
  baudRate = DEFAULT_BAUD,
): Link {
  const dataSubs = new Set<(b: Uint8Array) => void>();
  const closeSubs = new Set<(e?: Error) => void>();
  let state: "closed" | "open" | "closing" = "closed";
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let readLoop: Promise<void> = Promise.resolve();

  const finish = (error?: Error) => {
    if (state === "closed") return;
    state = "closed";
    closeSubs.forEach((cb) => cb(error));
  };

  const pump = async () => {
    try {
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.length) dataSubs.forEach((cb) => cb(value));
      }
    } catch {
      // The read fails when the cable is pulled; handled below.
    } finally {
      reader?.releaseLock();
      reader = undefined;
    }
    if (state === "open") {
      await port.close().catch(() => {});
      finish(new Error("The USB cable was disconnected"));
    }
  };

  return {
    kind: "usb",
    baudRate,
    async open() {
      await port.open({ baudRate });
      if (!port.readable) throw new Error("The serial port can't be read");
      state = "open";
      reader = port.readable.getReader();
      readLoop = pump();
    },
    async close() {
      if (state !== "open") return;
      state = "closing";
      await reader?.cancel().catch(() => {});
      await readLoop;
      await port.close().catch(() => {});
      finish();
    },
    async write(bytes) {
      if (state !== "open" || !port.writable)
        throw new Error("Not connected over USB");
      const writer = port.writable.getWriter();
      try {
        await writer.write(bytes);
      } finally {
        writer.releaseLock();
      }
    },
    onData(cb) {
      dataSubs.add(cb);
      return () => dataSubs.delete(cb);
    },
    onClose(cb) {
      closeSubs.add(cb);
      return () => closeSubs.delete(cb);
    },
  };
}
