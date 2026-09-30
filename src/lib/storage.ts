import { Preferences } from "@capacitor/preferences";

/** A controller this phone has connected to before. */
export type KnownDevice = {
  serial: string;
  name: string;
  lastLink: "ble" | "usb" | "mock";
  /** BLE peripheral id, to reconnect without scanning. */
  bleDeviceId?: string;
  lastSeen: number;
};

const KEY = "knownDevices.v1";

/** Most recently used first. Unreadable data counts as none rather than crashing the app. */
export async function getKnownDevices(): Promise<KnownDevice[]> {
  const { value } = await Preferences.get({ key: KEY });
  try {
    const list: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(list) ? (list as KnownDevice[]) : [];
  } catch {
    return [];
  }
}

export async function rememberDevice(device: KnownDevice): Promise<void> {
  const others = (await getKnownDevices()).filter(
    (d) => d.serial !== device.serial,
  );
  await Preferences.set({
    key: KEY,
    value: JSON.stringify([device, ...others]),
  });
}

export async function forgetDevice(serial: string): Promise<void> {
  const rest = (await getKnownDevices()).filter((d) => d.serial !== serial);
  await Preferences.set({ key: KEY, value: JSON.stringify(rest) });
}
