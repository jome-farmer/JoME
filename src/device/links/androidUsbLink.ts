import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { Link } from "../link";
import { DEFAULT_BAUD } from "./webSerialLink";

export type UsbSerialDevice = {
  deviceId: number;
  vendorId: number;
  productId: number;
  name: string;
};

/** Native side: android/app/src/main/java/ir/jomefarmer/jome/UsbSerialPlugin.java */
export interface UsbSerialPlugin {
  list(): Promise<{ devices: UsbSerialDevice[] }>;
  open(options: { deviceId: number; baudRate: number }): Promise<void>;
  write(options: { data: string }): Promise<void>;
  close(): Promise<void>;
  addListener(
    event: "data",
    cb: (e: { data: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "closed",
    cb: (e: { error: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const UsbSerial = registerPlugin<UsbSerialPlugin>("UsbSerial");

/** USB OTG serial exists only in the Android app. iOS can't do it at all (ADR 0001). */
export const isAndroidUsbAvailable = () =>
  Capacitor.getPlatform() === "android";

export async function listUsbSerial(
  plugin: UsbSerialPlugin = UsbSerial,
): Promise<UsbSerialDevice[]> {
  return (await plugin.list()).devices;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function createAndroidUsbLink(
  deviceId: number,
  baudRate = DEFAULT_BAUD,
  plugin: UsbSerialPlugin = UsbSerial,
): Link {
  const dataSubs = new Set<(b: Uint8Array) => void>();
  const closeSubs = new Set<(e?: Error) => void>();
  let state: "closed" | "open" | "closing" = "closed";
  let handles: PluginListenerHandle[] = [];

  const detach = async () => {
    const hs = handles;
    handles = [];
    await Promise.all(hs.map((h) => h.remove()));
  };
  const finish = (error?: Error) => {
    if (state === "closed") return;
    state = "closed";
    void detach();
    closeSubs.forEach((cb) => cb(error));
  };

  return {
    kind: "usb",
    peerId: String(deviceId),
    baudRate,
    async open() {
      // Listen first so no bytes the board sends right after opening are lost.
      handles = await Promise.all([
        plugin.addListener("data", (e) => {
          const bytes = fromBase64(e.data);
          dataSubs.forEach((cb) => cb(bytes));
        }),
        plugin.addListener("closed", (e) => finish(new Error(e.error))),
      ]);
      try {
        await plugin.open({ deviceId, baudRate });
      } catch (e) {
        await detach();
        throw e;
      }
      state = "open";
    },
    async close() {
      if (state !== "open") return;
      state = "closing";
      await plugin.close().catch(() => {});
      finish();
    },
    async write(bytes) {
      if (state !== "open") throw new Error("Not connected over USB");
      await plugin.write({ data: toBase64(bytes) });
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
