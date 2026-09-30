// Mirrors https://github.com/jome-farmer/protocol (proto v1). Change it there first
// (see "Changing the protocol"), then here.

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
  /** Valve outputs on this board (e.g. 8 or 16). */
  valveCount: number;
  /** Every command this firmware accepts. */
  cmds: string[];
};

export type Zone = {
  /** Id the board assigns. */
  zone: number;
  name: string;
  /** Valve output this zone drives, 1 … valveCount. One zone per valve. */
  valve: number;
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

export type ProgramState = {
  program: number;
  state: "started" | "step" | "finished" | "skipped";
  at?: Epoch;
  step?: number;
  zone?: number;
  reason?: "RAIN_DELAY" | "BUSY" | "CANCELLED";
};

export type Sensors = {
  /** Board LM35, 0.1 °C steps. null when out of range (sensor missing or broken). */
  temperatureC: number | null;
  /** Water through the pump line, L/min (last second). Firmware without a flow sensor omits it. */
  flowLpm?: number;
  /** Litres through the sensor since the board booted. */
  totalLiters?: number;
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
  /** Seconds. `total` is the length of this run. */
  running: {
    zone: number;
    remaining: number;
    total: number;
    program?: number;
    step?: number;
  }[];
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
  "zone.create": [
    { name: string; valve: number; defaultSeconds: number },
    { zone: number },
  ];
  "zone.update": [Partial<Omit<Zone, "zone">> & { zone: number }, Empty];
  "zone.delete": [{ zone: number }, Empty];
  "zone.run": [{ zone: number; seconds: number }, Empty];
  "zone.stop": [{ zone: number }, Empty];
  "stop.all": [Empty, Empty];
  "programs.list": [Empty, { programs: Program[] }];
  "program.save": [Program, { id: number }];
  "program.delete": [{ id: number }, Empty];
  "rain.delay": [{ hours: number }, { until: Epoch | null }];
  "device.rename": [{ name: string }, Empty];
  "device.reboot": [Empty, Empty];
  "sensors.read": [Empty, Sensors];
  "log.level": [
    { level: "error" | "warn" | "info" | "debug" | "trace" },
    Empty,
  ];
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
  "program.state": ProgramState;
  status: Status;
};
export type EventName = keyof Events;

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNKNOWN_CMD"
  | "ZONE_BUSY"
  | "NOT_FOUND"
  | "WIFI_FAILED"
  | "VALVE_IN_USE"
  | "ZONE_DISABLED"
  | "CLOCK_NOT_SET"
  | "INTERNAL"
  // Raised by the app, not the board:
  | "TIMEOUT"
  | "LINK_CLOSED";
