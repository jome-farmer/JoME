import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceClient } from "../services/device/client";
import { supports, useDevice } from "./DeviceContext";
import type { Program, Sensors, Status, Zone } from "../services/device/types";

export type GardenZone = Zone;

export type Run = {
  zone: number;
  /** Seconds left when last reported by the board. */
  remaining: number;
  total: number;
  /** Present when the board scheduler, rather than zone.run, started it. */
  program?: number;
  /** One-based step in `program`; present with program. */
  step?: number;
  /** Date.now() of that report, so we can count down smoothly in between. */
  at: number;
};

type ZonePatch = Partial<Omit<Zone, "zone">>;

/**
 * Live view of the board shared by Home and Zones: status, zones, programs, the running zone,
 * and the zone actions. Each screen that mounts it loads fresh data and follows board events.
 */
export function useGarden(client: DeviceClient | undefined) {
  const { info, offline } = useDevice();
  const [status, setStatus] = useState<Status>();
  const [zones, setZones] = useState<Zone[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const refreshedClient = useRef<DeviceClient | undefined>(undefined);

  const applyStatus = useCallback((s: Status) => {
    setStatus(s);
    const r = s.running[0];
    if (!r) return setRun(null);
    setRun({
      zone: r.zone,
      remaining: r.remaining,
      total: r.total,
      program: r.program,
      step: r.step,
      at: Date.now(),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      const [s, z, p] = await Promise.all([
        client.request("status", {}),
        client.request("zones.list", {}),
        client.request("programs.list", {}),
      ]);
      applyStatus(s);
      setZones(z.zones);
      setPrograms(p.programs);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [client, applyStatus]);

  useEffect(() => {
    if (!client) return;
    // StrictMode re-runs effects without remounting component state. Keep the
    // initial three-request refresh from being sent twice to the controller.
    if (refreshedClient.current !== client) {
      refreshedClient.current = client;
      void refresh();
    }
    const offs = [
      client.on("status", applyStatus),
      client.on("zone.state", (e) => {
        if (e.state === "watering" && e.remaining !== undefined) {
          if (e.total === undefined) return;
          setRun({
            zone: e.zone,
            remaining: e.remaining,
            total: e.total,
            at: Date.now(),
          });
        } else {
          setRun((r) => (r?.zone === e.zone ? null : r));
          // The next run may have moved on; ask once rather than guess.
          void client.request("status", {}).then(applyStatus, () => {});
        }
      }),
      client.on("program.state", (e) => {
        const { zone, step } = e;
        if (e.state !== "step" || zone === undefined || step === undefined)
          return;
        setRun((r) =>
          r?.zone === zone ? { ...r, program: e.program, step } : r,
        );
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [client, refresh, applyStatus]);

  // The board went offline or came back: the same reads now give the cloud copy, or the board's live state.
  const isOffline = offline !== undefined;
  const wasOffline = useRef(isOffline);
  useEffect(() => {
    if (wasOffline.current === isOffline) return;
    wasOffline.current = isOffline;
    void refresh();
  }, [isOffline, refresh]);

  // Sensors: flow matters while watering (every 2 s), temperature changes slowly (every minute).
  const canSense = supports(info, "sensors.read");
  const [sensors, setSensors] = useState<Sensors>();
  const watering = run !== null;
  useEffect(() => {
    if (!client || !canSense) return;
    const read = () =>
      client.request("sensors.read", {}).then(setSensors, () => {
        // Keep the last reading; the next tick tries again.
      });
    void read();
    const id = setInterval(read, watering ? 2000 : 60_000);
    return () => clearInterval(id);
  }, [client, canSense, watering]);

  // One tick a second keeps the ring and the timeline moving between board reports.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const runZone = useCallback(
    async (zone: number, seconds: number) => {
      if (!client) throw new Error("Not connected");
      await client.request("zone.run", { zone, seconds });
    },
    [client],
  );

  const stopZone = useCallback(
    async (zone: number) => {
      if (!client) throw new Error("Not connected");
      await client.request("zone.stop", { zone });
    },
    [client],
  );

  /** Optimistic: the change shows at once and rolls back if the board refuses it. */
  const updateZone = useCallback(
    async (zone: number, patch: ZonePatch) => {
      if (!client) throw new Error("Not connected");
      let before: Zone | undefined;
      setZones((zs) =>
        zs.map((z) => {
          if (z.zone !== zone) return z;
          before = z;
          return { ...z, ...patch };
        }),
      );
      try {
        await client.request("zone.update", { zone, ...patch });
      } catch (e) {
        if (before) {
          const restore = before;
          setZones((zs) => zs.map((z) => (z.zone === zone ? restore : z)));
        }
        throw e;
      }
    },
    [client],
  );

  /** Add a zone on a free valve. */
  const createZone = useCallback(
    async (zone: { name: string; valve: number; defaultSeconds: number }) => {
      if (!client) throw new Error("Not connected");
      await client.request("zone.create", zone);
      await refresh();
    },
    [client, refresh],
  );

  /** Remove a zone: programs stop watering it and its valve becomes free. */
  const deleteZone = useCallback(
    async (zone: number) => {
      if (!client) throw new Error("Not connected");
      await client.request("zone.delete", { zone });
      await refresh();
    },
    [client, refresh],
  );

  /** Create (no id) or replace a program; the board may adjust it, so reload the list. */
  const saveProgram = useCallback(
    async (program: Program) => {
      if (!client) throw new Error("Not connected");
      const { id } = await client.request("program.save", program);
      setPrograms((await client.request("programs.list", {})).programs);
      return id;
    },
    [client],
  );

  const deleteProgram = useCallback(
    async (id: number) => {
      if (!client) throw new Error("Not connected");
      await client.request("program.delete", { id });
      setPrograms((ps) => ps.filter((p) => p.id !== id));
    },
    [client],
  );

  /** Optimistic on/off switch; rolls back if the board refuses. */
  const setProgramEnabled = useCallback(
    async (program: Program, enabled: boolean) => {
      if (!client) throw new Error("Not connected");
      const swap = (p: Program) => (ps: Program[]) =>
        ps.map((x) => (x.id === p.id ? p : x));
      setPrograms(swap({ ...program, enabled }));
      try {
        await client.request("program.save", { ...program, enabled });
      } catch (e) {
        setPrograms(swap(program));
        throw e;
      }
    },
    [client],
  );

  // Offline, the copy's run is history, not water flowing now (design: Board offline).
  const live = isOffline ? null : run;
  const remaining = live
    ? Math.max(0, live.remaining - (now - live.at) / 1000)
    : 0;

  return {
    status,
    zones,
    /** Valve outputs on this board. */
    valveCount: info?.valveCount ?? 0,
    canMoveValve: true,
    programs,
    run: live,
    /** Offline only: the zone that was watering at the last sync. */
    wasWatering: isOffline ? status?.running[0]?.zone : undefined,
    remaining,
    now,
    /** Latest sensors.read; undefined until read or when the board has no sensors. */
    sensors: canSense ? sensors : undefined,
    error,
    refresh,
    runZone,
    stopZone,
    updateZone,
    createZone,
    deleteZone,
    saveProgram,
    deleteProgram,
    setProgramEnabled,
  };
}
