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
  await Preferences.remove({ key: placeKey(serial) });
}

/** Where a controller's garden is, in degrees. Kept on this phone only. */
export type Place = { lat: number; lon: number };

const placeKey = (serial: string) => `gardenPlace.v1.${serial}`;

export async function getGardenPlace(
  serial: string,
): Promise<Place | undefined> {
  const { value } = await Preferences.get({ key: placeKey(serial) });
  try {
    const p = JSON.parse(value ?? "null") as Place | null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon)
      ? p
      : undefined;
  } catch {
    return undefined;
  }
}

export async function setGardenPlace(
  serial: string,
  place: Place,
): Promise<void> {
  await Preferences.set({
    key: placeKey(serial),
    value: JSON.stringify(place),
  });
}

/** Small yes/no settings, e.g. whether the assistant's data notice was accepted. */
export async function getFlag(key: string): Promise<boolean> {
  return (await Preferences.get({ key })).value === "1";
}

export async function setFlag(key: string, on: boolean): Promise<void> {
  await Preferences.set({ key, value: on ? "1" : "0" });
}
