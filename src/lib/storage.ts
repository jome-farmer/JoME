import { Preferences } from "@capacitor/preferences";

/** A controller this phone has connected to before. */
export type KnownDevice = {
  serial: string;
  name: string;
  lastLink: "ble" | "usb" | "mock" | "cloud";
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

/** Boards on the account that this phone hasn't seen yet go to the end of the list. */
export async function addKnownDevices(
  boards: { serial: string; name: string }[],
): Promise<void> {
  const known = await getKnownDevices();
  const added = boards
    .filter((b) => !known.some((d) => d.serial === b.serial))
    .map(({ serial, name }): KnownDevice => ({
      serial,
      name,
      lastLink: "cloud",
      lastSeen: 0,
    }));
  if (added.length)
    await Preferences.set({
      key: KEY,
      value: JSON.stringify([...known, ...added]),
    });
}

export async function forgetDevice(serial: string): Promise<void> {
  const rest = (await getKnownDevices()).filter((d) => d.serial !== serial);
  await Preferences.set({ key: KEY, value: JSON.stringify(rest) });
  await Preferences.remove({ key: placeKey(serial) });
  await Preferences.remove({ key: shapesKey(serial) });
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

/** Zone outlines drawn on the map, by zone id: corners as [lat, lon]. Kept on this phone until the server stores them. */
export type ZoneShapes = Record<number, [number, number][]>;

const shapesKey = (serial: string) => `zoneShapes.v1.${serial}`;

export async function getZoneShapes(serial: string): Promise<ZoneShapes> {
  const { value } = await Preferences.get({ key: shapesKey(serial) });
  try {
    const s: unknown = JSON.parse(value ?? "{}");
    return s && typeof s === "object" ? (s as ZoneShapes) : {};
  } catch {
    return {};
  }
}

export async function setZoneShapes(
  serial: string,
  shapes: ZoneShapes,
): Promise<void> {
  await Preferences.set({
    key: shapesKey(serial),
    value: JSON.stringify(shapes),
  });
}
