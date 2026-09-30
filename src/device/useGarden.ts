import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceClient } from "./client";
import { useDevice } from "./DeviceContext";
import type { Program, Status, Zone } from "./types";

/** A zone as the app shows it: it always has a valve. */
export type GardenZone = Zone & { valve: number };

export const defaultZoneName = (zone: number) => `Zone ${zone}`;

/**
 * Firmware v1 has fixed zones 1..zoneCount, where zone N is valve N (protocol §2).
 * There, a zone that's off and still has its default name is a free valve.
 */
export const isFreeFixedZone = (z: Zone) =>
  !z.enabled && z.name === defaultZoneName(z.zone);

/** Zones the app lists: every zone on boards with valves, only the used ones on fixed-zone boards. */
export function gardenZones(
  zones: Zone[],
  valvesOnBoard: boolean,
): GardenZone[] {
  return valvesOnBoard
    ? zones.map((z) => ({ ...z, valve: z.valve ?? z.zone }))
    : zones
        .filter((z) => !isFreeFixedZone(z))
        .map((z) => ({ ...z, valve: z.zone }));
}

export type Run = {
  zone: number;
  /** Seconds left when last reported by the board. */
  remaining: number;
  total: number;
  /** Date.now() of that report, so we can count down smoothly in between. */
  at: number;
};

type ZonePatch = Partial<Omit<Zone, "zone">>;

/**
 * Live view of the board shared by Home and Zones: status, zones, programs, the running zone,
 * and the zone actions. Each screen that mounts it loads fresh data and follows board events.
 */
/**
 * What zone.delete does on newer boards, done step by step on fixed-zone boards:
 * take the zone out of programs, then turn it off and give back its default name.
 */
export async function deleteFixedZone(
  client: DeviceClient,
  programs: Program[],
  zone: number,
): Promise<void> {
  for (const p of programs.filter((p) =>
    p.steps.some((s) => s.zone === zone),
  )) {
    const steps = p.steps.filter((s) => s.zone !== zone);
    // A program needs at least one step; one left with none is turned off instead.
    await client.request(
      "program.save",
      steps.length ? { ...p, steps } : { ...p, enabled: false },
    );
  }
  await client.request("zone.update", {
    zone,
    enabled: false,
    name: defaultZoneName(zone),
  });
}

export function useGarden(client: DeviceClient | undefined) {
  const { info } = useDevice();
  // Boards with zone.create (SHamBE#19) manage zones and valves; firmware v1 has fixed zones.
  const valvesOnBoard = info?.cmds?.includes("zone.create") ?? false;
  const [status, setStatus] = useState<Status>();
  const [zones, setZones] = useState<Zone[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  // Boards that don't send `total`: remember the first `remaining` seen for this run instead.
  const firstSeen = useRef(new Map<number, number>());

  const applyStatus = useCallback((s: Status) => {
    setStatus(s);
    const r = s.running[0];
    if (!r) return setRun(null);
    const total = r.total ?? firstSeen.current.get(r.zone) ?? r.remaining;
    firstSeen.current.set(r.zone, total);
    setRun({ zone: r.zone, remaining: r.remaining, total, at: Date.now() });
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
    void refresh();
    const offs = [
      client.on("status", applyStatus),
      client.on("zone.state", (e) => {
        if (e.state === "watering" && e.remaining !== undefined) {
          const total = e.total ?? firstSeen.current.get(e.zone) ?? e.remaining;
          firstSeen.current.set(e.zone, total);
          setRun({
            zone: e.zone,
            remaining: e.remaining,
            total,
            at: Date.now(),
          });
        } else {
          firstSeen.current.delete(e.zone);
          setRun((r) => (r?.zone === e.zone ? null : r));
          // The next run may have moved on; ask once rather than guess.
          void client.request("status", {}).then(applyStatus, () => {});
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [client, refresh, applyStatus]);

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
      if (valvesOnBoard) await client.request("zone.create", zone);
      // Fixed zones: the valve's zone already exists; name it and turn it on.
      else
        await client.request("zone.update", {
          zone: zone.valve,
          name: zone.name,
          defaultSeconds: zone.defaultSeconds,
          enabled: true,
        });
      await refresh();
    },
    [client, valvesOnBoard, refresh],
  );

  /** Remove a zone: programs stop watering it and its valve becomes free. */
  const deleteZone = useCallback(
    async (zone: number) => {
      if (!client) throw new Error("Not connected");
      if (valvesOnBoard) {
        await client.request("zone.delete", { zone });
      } else {
        await deleteFixedZone(client, programs, zone);
      }
      await refresh();
    },
    [client, valvesOnBoard, programs, refresh],
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

  const remaining = run
    ? Math.max(0, run.remaining - (now - run.at) / 1000)
    : 0;

  return {
    status,
    zones: gardenZones(zones, valvesOnBoard),
    /** Valve outputs on this board. */
    valveCount: valvesOnBoard
      ? (info?.valveCount ??
        Math.max(8, ...zones.map((z) => z.valve ?? z.zone)))
      : (info?.zoneCount ?? zones.length),
    /** Only boards that manage valves can move a zone to another valve. */
    canMoveValve: valvesOnBoard,
    programs,
    run,
    remaining,
    now,
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
