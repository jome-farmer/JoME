import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import type { Link } from "../link";

/** Nordic UART Service (docs/device-protocol.md §1). RX: app → board, TX: board → app. */
export const NUS = {
  service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  rx: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  tx: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
};
const NAME_PREFIX = "JoME-";
/** BLE's minimum ATT payload (MTU 23 − 3). Used on the web, where the MTU can't be read. */
const MIN_CHUNK = 20;

export type FoundDevice = { deviceId: string; name: string; rssi?: number };

/** Native apps scan and list devices in our own UI; browsers show their own chooser instead. */
export const canScanInApp = () => Capacitor.isNativePlatform();
export const isBleAvailable = () =>
  Capacitor.isNativePlatform() ||
  (typeof navigator !== "undefined" && "bluetooth" in navigator);

let initialized: Promise<void> | undefined;
function init(): Promise<void> {
  initialized ??= BleClient.initialize({ androidNeverForLocation: true }).catch(
    (e: unknown) => {
      initialized = undefined; // Let a later attempt ask again, e.g. after Bluetooth is switched on.
      throw e;
    },
  );
  return initialized;
}

/** Native only. Calls onFound for each advertisement from a JoME board. Returns a stop function. */
export async function scanForJoME(
  onFound: (d: FoundDevice) => void,
): Promise<() => Promise<void>> {
  await init();
  await BleClient.requestLEScan(
    { namePrefix: NAME_PREFIX, optionalServices: [NUS.service] },
    (r) =>
      onFound({
        deviceId: r.device.deviceId,
        name: r.localName ?? r.device.name ?? "JoME",
        rssi: r.rssi,
      }),
  );
  return () => BleClient.stopLEScan();
}

/** Web: opens the browser's Bluetooth chooser, filtered to JoME boards. Needs a user gesture. */
export async function pickJoME(): Promise<FoundDevice> {
  await init();
  const d = await BleClient.requestDevice({
    namePrefix: NAME_PREFIX,
    optionalServices: [NUS.service],
  });
  return { deviceId: d.deviceId, name: d.name ?? "JoME" };
}

export function chunks(bytes: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size)
    out.push(bytes.subarray(i, i + size));
  return out;
}

/**
 * A Link over the board's Nordic UART Service.
 * Pairing (LE Secure Connections + passkey) is shown by the OS the first time an encrypted characteristic is used.
 */
export function createBleLink(deviceId: string): Link {
  const dataSubs = new Set<(b: Uint8Array) => void>();
  const closeSubs = new Set<(e?: Error) => void>();
  let state: "closed" | "open" | "closing" = "closed";
  let chunkSize = MIN_CHUNK;

  const finish = (error?: Error) => {
    if (state === "closed") return;
    state = "closed";
    closeSubs.forEach((cb) => cb(error));
  };

  return {
    kind: "ble",
    peerId: deviceId,
    async open() {
      await init();
      await BleClient.connect(deviceId, () =>
        finish(
          state === "closing"
            ? undefined
            : new Error("Bluetooth connection lost"),
        ),
      );
      state = "open";
      try {
        if (Capacitor.isNativePlatform()) {
          chunkSize = Math.max(
            MIN_CHUNK,
            (await BleClient.getMtu(deviceId)) - 3,
          );
        }
        await BleClient.startNotifications(deviceId, NUS.service, NUS.tx, (v) =>
          dataSubs.forEach((cb) =>
            cb(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
          ),
        );
      } catch (e) {
        // Not a JoME, or pairing was refused: don't leave a half-open connection behind.
        state = "closing";
        await BleClient.disconnect(deviceId).catch(() => {});
        state = "closed";
        throw e;
      }
    },
    async close() {
      if (state !== "open") return;
      state = "closing";
      await BleClient.stopNotifications(deviceId, NUS.service, NUS.tx).catch(
        () => {},
      );
      await BleClient.disconnect(deviceId).catch(() => {});
      finish();
    },
    async write(bytes) {
      if (state !== "open") throw new Error("Not connected over Bluetooth");
      // With-response writes: slower than without, but the board can't silently drop a chunk.
      for (const c of chunks(bytes, chunkSize)) {
        await BleClient.write(
          deviceId,
          NUS.service,
          NUS.rx,
          new DataView(c.buffer, c.byteOffset, c.byteLength),
        );
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
