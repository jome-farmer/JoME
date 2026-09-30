import type { Link } from "../link";
import { encodeLine, LineDecoder } from "../lineCodec";
import {
  PROTOCOL_VERSION,
  type ErrorCode,
  type Program,
  type Status,
  type WifiNetwork,
  type Zone,
} from "../types";

/**
 * An in-memory JoME board speaking protocol v1 (docs/device-protocol.md).
 * Used for Demo mode, development without hardware, and tests.
 * Like the real controller, it runs one zone at a time.
 */
export function createMockLink(): Link {
  const decoder = new LineDecoder();
  const dataSubs = new Set<(b: Uint8Array) => void>();
  const closeSubs = new Set<(e?: Error) => void>();
  const bootedAt = Date.now();
  let open = false;
  let ticker: ReturnType<typeof setInterval> | undefined;

  let name = "Demo garden";
  const zones: Zone[] = [
    { zone: 1, name: "Front lawn", enabled: true, defaultSeconds: 1200 },
    { zone: 2, name: "Backyard hedge", enabled: true, defaultSeconds: 900 },
    { zone: 3, name: "Vegetable beds", enabled: true, defaultSeconds: 600 },
    { zone: 4, name: "Fruit trees", enabled: true, defaultSeconds: 2400 },
    { zone: 5, name: "Pots", enabled: true, defaultSeconds: 480 },
    { zone: 6, name: "Pool side", enabled: false, defaultSeconds: 600 },
  ];
  const programs: Program[] = [
    {
      id: 1,
      name: "Morning",
      enabled: true,
      days: [1, 3, 5],
      start: "06:00",
      steps: [
        { zone: 1, seconds: 1200 },
        { zone: 2, seconds: 900 },
        { zone: 4, seconds: 2400 },
      ],
    },
    {
      id: 2,
      name: "Evening",
      enabled: true,
      days: [0, 1, 2, 3, 4, 5, 6],
      start: "18:00",
      steps: [
        { zone: 3, seconds: 600 },
        { zone: 5, seconds: 480 },
      ],
    },
    {
      id: 3,
      name: "Drip pots",
      enabled: false,
      days: [2, 6],
      start: "21:30",
      steps: [{ zone: 5, seconds: 480 }],
    },
  ];
  const networks: WifiNetwork[] = [
    { ssid: "Baharestan-Home", rssi: -48, secure: true },
    { ssid: "Greenhouse-AP", rssi: -63, secure: true },
    { ssid: "Neighbours_Guest", rssi: -79, secure: false },
  ];
  let wifi: Status["wifi"] = {
    state: "connected",
    ssid: "Baharestan-Home",
    ip: "192.168.1.42",
  };
  let rainDelayUntil: number | null = null;
  let running: { zone: number; remaining: number; total: number } | null = null;

  const emit = (text: string) => {
    if (!open) return;
    const bytes = encodeLine(text);
    dataSubs.forEach((cb) => cb(bytes));
  };
  const log = (level: "I" | "W" | "E", tag: string, msg: string) =>
    emit(`${level} (${Date.now() - bootedAt}) ${tag}: ${msg}`);
  const event = (evt: string, data: unknown) =>
    emit(JSON.stringify({ evt, data }));
  const now = () => Math.floor(Date.now() / 1000);

  /** The earliest enabled program start after now, looking a week ahead, like the firmware's scheduler. */
  const nextRun = (): Status["nextRun"] => {
    const t = new Date();
    for (let d = 0; d < 8; d++) {
      const day = new Date(t.getFullYear(), t.getMonth(), t.getDate() + d);
      const next = programs
        .filter((p) => p.enabled && p.days.includes(day.getDay()))
        .map((p) => {
          const [h, m] = p.start.split(":").map(Number);
          return {
            p,
            at: new Date(
              day.getFullYear(),
              day.getMonth(),
              day.getDate(),
              h,
              m,
            ),
          };
        })
        .filter((c) => c.at > t)
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
      if (next)
        return {
          program: next.p.id ?? 0,
          name: next.p.name,
          at: Math.floor(next.at.getTime() / 1000),
        };
    }
    return null;
  };

  const status = (): Status => ({
    wifi,
    rainDelayUntil,
    running: running ? [{ ...running }] : [],
    nextRun: nextRun(),
  });

  const stopZone = (zone: number) => {
    if (running?.zone !== zone) return;
    running = null;
    log("I", "valve", `zone ${zone} CLOSED`);
    event("zone.state", { zone, state: "idle" });
  };

  const tick = () => {
    if (!running) return;
    running.remaining -= 1;
    if (running.remaining <= 0) stopZone(running.zone);
    else
      event("zone.state", {
        zone: running.zone,
        state: "watering",
        remaining: running.remaining,
        total: running.total,
      });
  };

  class Fail extends Error {
    constructor(
      readonly code: ErrorCode,
      message: string,
    ) {
      super(message);
    }
  }
  const findZone = (zone: unknown) => {
    const z = zones.find((x) => x.zone === zone);
    if (!z) throw new Fail("NOT_FOUND", `There is no zone ${String(zone)}`);
    return z;
  };

  // Each handler returns the response data or throws Fail.
  const handlers: Record<string, (a: Record<string, unknown>) => unknown> = {
    hello: () => ({
      proto: PROTOCOL_VERSION,
      fw: "1.4.2",
      hw: "SIM",
      serial: "JM-DEMO-0001",
      name,
      zoneCount: zones.length,
    }),
    "time.set": () => ({}),
    status,
    "wifi.scan": () => ({ networks }),
    "wifi.set": (a) => {
      const ssid = String(a.ssid ?? "");
      wifi = { state: "connecting", ssid };
      setTimeout(() => event("wifi.state", wifi), 0);
      setTimeout(() => {
        // Passwords starting with "wrong" fail (e.g. "wrong-password", long enough to pass validation).
        wifi = String(a.password).startsWith("wrong")
          ? { state: "failed", ssid, reason: "Wrong password" }
          : { state: "connected", ssid, ip: "192.168.1.42" };
        log(
          wifi.state === "connected" ? "I" : "W",
          "wifi",
          `${wifi.state} ssid=${ssid}`,
        );
        event("wifi.state", wifi);
      }, 1500);
      return {};
    },
    "zones.list": () => ({ zones }),
    "zone.update": (a) => {
      const z = findZone(a.zone);
      if (typeof a.name === "string") z.name = a.name.slice(0, 32);
      if (typeof a.enabled === "boolean") {
        z.enabled = a.enabled;
        if (!z.enabled) stopZone(z.zone);
      }
      if (typeof a.defaultSeconds === "number")
        z.defaultSeconds = a.defaultSeconds;
      return {};
    },
    "zone.run": (a) => {
      const z = findZone(a.zone);
      const seconds = Number(a.seconds);
      if (!z.enabled)
        throw new Fail("BAD_REQUEST", `Zone ${z.zone} is turned off`);
      if (!(seconds >= 1 && seconds <= 3600))
        throw new Fail("BAD_REQUEST", "Run time must be 1 s to 60 min");
      if (running && running.zone !== z.zone)
        throw new Fail("ZONE_BUSY", `Zone ${running.zone} is running`);
      running = { zone: z.zone, remaining: seconds, total: seconds };
      log("I", "valve", `zone ${z.zone} OPEN`);
      event("zone.state", {
        zone: z.zone,
        state: "watering",
        remaining: seconds,
        total: seconds,
      });
      return {};
    },
    "zone.stop": (a) => (stopZone(findZone(a.zone).zone), {}),
    "stop.all": () => (running && stopZone(running.zone), {}),
    "programs.list": () => ({ programs }),
    "program.save": (a) => {
      const p = a as unknown as Program;
      const i = programs.findIndex((x) => x.id === p.id);
      const id =
        i >= 0 ? p.id! : Math.max(0, ...programs.map((x) => x.id ?? 0)) + 1;
      const saved = { ...p, id };
      if (i >= 0) programs[i] = saved;
      else programs.push(saved);
      return { id };
    },
    "program.delete": (a) => {
      const i = programs.findIndex((x) => x.id === a.id);
      if (i < 0)
        throw new Fail("NOT_FOUND", `There is no program ${String(a.id)}`);
      programs.splice(i, 1);
      return {};
    },
    "rain.delay": (a) => {
      const hours = Number(a.hours);
      rainDelayUntil = hours > 0 ? now() + hours * 3600 : null;
      return { until: rainDelayUntil };
    },
    "device.rename": (a) => {
      name = String(a.name ?? name).slice(0, 32);
      return {};
    },
  };

  const handleLine = (line: ReturnType<LineDecoder["push"]>[number]) => {
    if (line.kind === "log") {
      log(
        "E",
        "cli",
        `unknown command '${line.text}', the demo board only speaks the app protocol`,
      );
      return;
    }
    const { id, cmd, args } = line.msg;
    const handler = typeof cmd === "string" ? handlers[cmd] : undefined;
    let reply: unknown;
    try {
      if (!handler)
        throw new Fail("UNKNOWN_CMD", `Unknown command "${String(cmd)}"`);
      reply = {
        id,
        ok: true,
        data: handler((args ?? {}) as Record<string, unknown>),
      };
    } catch (e) {
      const f = e instanceof Fail ? e : new Fail("INTERNAL", String(e));
      reply = { id, ok: false, error: { code: f.code, message: f.message } };
    }
    // A little latency so loading states are visible in the demo.
    setTimeout(() => emit(JSON.stringify(reply)), 40);
  };

  const close = (error?: Error) => {
    if (!open) return;
    open = false;
    clearInterval(ticker);
    closeSubs.forEach((cb) => cb(error));
  };

  return {
    kind: "mock",
    async open() {
      open = true;
      ticker = setInterval(tick, 1000);
      log("I", "jome", "boot fw=1.4.2 hw=SIM (demo)");
      log("I", "wifi", `connected ssid=${wifi.ssid}`);
    },
    async close() {
      close();
    },
    async write(bytes) {
      if (!open) throw new Error("The demo board is not connected");
      decoder.push(bytes).forEach(handleLine);
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
