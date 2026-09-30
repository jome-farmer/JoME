// Mirrors docs/device-protocol.md (proto v1). Change both in the same PR.

export const PROTOCOL_VERSION = 1;

/** Seconds since the Unix epoch. */
export type Epoch = number;

export type Hello = {
  proto: number;
  fw: string;
  hw: string;
  serial: string;
  name: string;
  zoneCount: number;
};

export type Zone = {
  zone: number;
  name: string;
  enabled: boolean;
  defaultSeconds: number;
};

export type Program = {
  id?: number;
  name: string;
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** "HH:MM", device local time. */
  start: string;
  /** Run in order. */
  steps: { zone: number; seconds: number }[];
};

export type WifiState = {
  state: "disconnected" | "connecting" | "connected" | "failed";
  ssid?: string;
  ip?: string;
  reason?: string;
};

export type Status = {
  wifi: WifiState;
  rainDelayUntil: Epoch | null;
  /** Seconds. `total` is the length of this run (optional; older boards may omit it). */
  running: { zone: number; remaining: number; total?: number }[];
  nextRun: { program: number; name: string; at: Epoch } | null;
};

export type WifiNetwork = { ssid: string; rssi: number; secure: boolean };

type Empty = Record<string, never>;

/** cmd → [args, data]. DeviceClient.request is typed from this map. */
export type Commands = {
  hello: [Empty, Hello];
  "time.set": [{ epoch: Epoch; tz: string }, Empty];
  status: [Empty, Status];
  "wifi.scan": [Empty, { networks: WifiNetwork[] }];
  "wifi.set": [{ ssid: string; password: string }, Empty];
  "zones.list": [Empty, { zones: Zone[] }];
  "zone.update": [Partial<Omit<Zone, "zone">> & { zone: number }, Empty];
  "zone.run": [{ zone: number; seconds: number }, Empty];
  "zone.stop": [{ zone: number }, Empty];
  "stop.all": [Empty, Empty];
  "programs.list": [Empty, { programs: Program[] }];
  "program.save": [Program, { id: number }];
  "program.delete": [{ id: number }, Empty];
  "rain.delay": [{ hours: number }, { until: Epoch | null }];
  "device.rename": [{ name: string }, Empty];
};
export type Command = keyof Commands;
export type Args<C extends Command> = Commands[C][0];
export type Result<C extends Command> = Commands[C][1];

/** evt → data. */
export type Events = {
  "zone.state": {
    zone: number;
    state: "idle" | "watering" | "disabled";
    remaining?: number;
    total?: number;
  };
  "wifi.state": WifiState;
  status: Status;
};
export type EventName = keyof Events;

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNKNOWN_CMD"
  | "ZONE_BUSY"
  | "NOT_FOUND"
  | "WIFI_FAILED"
  | "INTERNAL"
  // Raised by the app, not the board:
  | "TIMEOUT"
  | "LINK_CLOSED";
