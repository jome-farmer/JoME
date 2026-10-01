import type { Link } from "./link";
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
 * An in-memory JoME board speaking protocol v1 (https://github.com/jome-farmer/protocol).
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
  const VALVES = 8;
  const DEMO: Omit<Zone, "zone">[] = [
    { name: "Front lawn", valve: 1, enabled: true, defaultSeconds: 1200 },
    { name: "Backyard hedge", valve: 2, enabled: true, defaultSeconds: 900 },
    { name: "Vegetable beds", valve: 5, enabled: true, defaultSeconds: 600 },
    { name: "Fruit trees", valve: 4, enabled: true, defaultSeconds: 2400 },
    { name: "Pots", valve: 7, enabled: true, defaultSeconds: 480 },
    { name: "Pool side", valve: 6, enabled: false, defaultSeconds: 600 },
  ];
  const zones: Zone[] = DEMO.map((z, i) => ({ ...z, zone: i + 1 }));
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
  let clockSet = false;
  let running: { zone: number; remaining: number; total: number } | null = null;
  // Flow sensor: litres since "boot", advanced whenever it's read.
  let litres = 0;
  let litresAt = Date.now();

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
    // Without the time the board can't schedule (protocol §3 time.set).
    nextRun: clockSet ? nextRun() : null,
  });

  // Usage log (usage.read): litres per local day and zone, like the board keeps.
  const DEMO_LPM = 11.5;
  const usage = new Map<
    string,
    Map<number, { liters: number; seconds: number }>
  >();
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addUsage = (date: string, zone: number, seconds: number) => {
    const day = usage.get(date) ?? new Map();
    const z = day.get(zone) ?? { liters: 0, seconds: 0 };
    day.set(zone, {
      liters: z.liters + (DEMO_LPM * seconds) / 60,
      seconds: z.seconds + seconds,
    });
    usage.set(date, day);
  };
  // Some history: the evening program on most days, the hedge every third.
  for (let ago = 1; ago <= 60; ago++) {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    if (ago % 7 === 3) continue; // a rain day
    addUsage(dayKey(d), 1, 600 + (ago % 5) * 60);
    addUsage(dayKey(d), 3, 480);
    if (ago % 3 === 0) addUsage(dayKey(d), 2, 900);
  }

  const stopZone = (zone: number) => {
    if (running?.zone !== zone) return;
    addUsage(dayKey(new Date()), zone, running.total - running.remaining);
    running = null;
    const z = zones.find((x) => x.zone === zone);
    const valve = z?.valve ?? zone;
    log("I", "valve", `${valve} CLOSED (zone ${zone})`);
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
  /** A valve number in range and not used by another zone (one zone per valve). */
  const checkValve = (valve: unknown, self?: number) => {
    const v = Number(valve);
    if (!Number.isInteger(v) || v < 1 || v > VALVES)
      throw new Fail("BAD_REQUEST", `Valve must be 1 to ${VALVES}`);
    const owner = zones.find((z) => z.valve === v && z.zone !== self);
    if (owner)
      throw new Fail("VALVE_IN_USE", `Valve ${v} is used by ${owner.name}`);
    return v;
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
      valveCount: VALVES,
      cmds: Object.keys(handlers).sort(),
    }),
    "time.set": () => {
      clockSet = true;
      return {};
    },
    status,
    "wifi.scan": () => ({ networks }),
    "wifi.set": (a) => {
      const ssid = String(a.ssid ?? "");
      wifi = { state: "connecting" }; // firmware v1 sends no ssid here
      setTimeout(() => event("wifi.state", wifi), 0);
      setTimeout(() => {
        // Passwords starting with "wrong" fail (e.g. "wrong-password", long enough to pass validation).
        wifi = String(a.password).startsWith("wrong")
          ? { state: "failed", ssid, reason: "AUTH_FAIL" }
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
      // v1 boards ignore unknown fields (protocol §2), valve included.
      if (a.valve !== undefined) z.valve = checkValve(a.valve, z.zone);
      return {};
    },
    "zone.create": (a) => {
      const name = String(a.name ?? "")
        .trim()
        .slice(0, 32);
      if (!name) throw new Fail("BAD_REQUEST", "Give the zone a name");
      const valve = checkValve(a.valve);
      const seconds = Number(a.defaultSeconds ?? 600);
      if (!(seconds >= 1 && seconds <= 3600))
        throw new Fail("BAD_REQUEST", "Run time must be 1 s to 60 min");
      const zone = Math.max(0, ...zones.map((z) => z.zone)) + 1;
      zones.push({ zone, name, valve, enabled: true, defaultSeconds: seconds });
      log("I", "zones", `zone ${zone} "${name}" on valve ${valve}`);
      return { zone };
    },
    "zone.delete": (a) => {
      const z = findZone(a.zone);
      stopZone(z.zone);
      zones.splice(zones.indexOf(z), 1);
      // Programs stop watering it; a program left with nothing to water is turned off.
      for (const p of programs) {
        p.steps = p.steps.filter((s) => s.zone !== z.zone);
        if (p.steps.length === 0) p.enabled = false;
      }
      log("I", "zones", `zone ${z.zone} deleted, valve ${z.valve} free`);
      return {};
    },
    "zone.run": (a) => {
      const z = findZone(a.zone);
      const seconds = Number(a.seconds);
      if (!z.enabled)
        throw new Fail("ZONE_DISABLED", `Zone ${z.zone} is turned off`);
      if (!(seconds >= 1 && seconds <= 3600))
        throw new Fail("BAD_REQUEST", "Run time must be 1 s to 60 min");
      if (running && running.zone !== z.zone)
        throw new Fail("ZONE_BUSY", `Zone ${running.zone} is running`);
      running = { zone: z.zone, remaining: seconds, total: seconds };
      log("I", "valve", `${z.valve} OPEN (zone ${z.zone})`);
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
      if (hours > 0 && !clockSet)
        throw new Fail("CLOCK_NOT_SET", "Clock not set; send time.set first");
      rainDelayUntil = hours > 0 ? now() + hours * 3600 : null;
      return { until: rainDelayUntil };
    },
    "usage.read": (a) => {
      const days = Number(a.days);
      if (!Number.isInteger(days) || days < 1 || days > 90)
        throw new Fail("BAD_REQUEST", "days must be 1-90");
      if (!clockSet)
        throw new Fail("CLOCK_NOT_SET", "Clock not set; send time.set first");
      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      const first = dayKey(from);
      const outDays: { date: string; liters: number }[] = [];
      const byZone = new Map<number, { liters: number; seconds: number }>();
      for (const date of [...usage.keys()].sort()) {
        if (date < first) continue;
        let total = 0;
        for (const [zone, u] of usage.get(date)!) {
          total += u.liters;
          const sum = byZone.get(zone) ?? { liters: 0, seconds: 0 };
          byZone.set(zone, {
            liters: sum.liters + u.liters,
            seconds: sum.seconds + u.seconds,
          });
        }
        outDays.push({ date, liters: Math.round(total * 10) / 10 });
      }
      return {
        days: outDays,
        zones: [...byZone]
          .sort(([a], [b]) => a - b)
          .map(([zone, u]) => ({
            zone,
            liters: Math.round(u.liters * 10) / 10,
            seconds: u.seconds,
          })),
      };
    },
    "device.reboot": () => {
      if (running) stopZone(running.zone);
      log("W", "jome", "restarting");
      // Reply first, then drop the link like the real board (protocol §3 device.reboot).
      setTimeout(() => close(new Error("JoME restarted")), 300);
      return {};
    },
    "sensors.read": () => {
      const t = Date.now();
      const flowLpm = running
        ? Math.round((11.5 + Math.sin(t / 7000) * 0.8) * 10) / 10
        : 0;
      litres += (flowLpm * (t - litresAt)) / 60_000;
      litresAt = t;
      return {
        temperatureC: Math.round((27 + Math.sin(t / 600_000) * 2) * 10) / 10,
        flowLpm,
        totalLiters: Math.round(litres * 10) / 10,
      };
    },
    "log.level": (a) => {
      if (
        !["error", "warn", "info", "debug", "trace"].includes(String(a.level))
      )
        throw new Fail(
          "BAD_REQUEST",
          "level must be error, warn, info, debug or trace",
        );
      return {};
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
