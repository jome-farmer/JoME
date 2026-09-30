import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceClient } from "./client";
import type { Program, Status, Zone } from "./types";

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
export function useGarden(client: DeviceClient | undefined) {
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

  const createZone = useCallback(
    async (zone: Omit<Zone, "zone" | "enabled">) => {
      if (!client) throw new Error("Not connected");
      const created = await client.request("zone.create", zone);
      setZones((zs) => [...zs, { ...zone, zone: created.zone, enabled: true }]);
      return created.zone;
    },
    [client],
  );

  const deleteZone = useCallback(
    async (zone: number) => {
      if (!client) throw new Error("Not connected");
      await client.request("zone.delete", { zone });
      // Programs changed on the board too (steps removed), so reload everything.
      await refresh();
    },
    [client, refresh],
  );

  const remaining = run
    ? Math.max(0, run.remaining - (now - run.at) / 1000)
    : 0;

  return {
    status,
    zones,
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
  };
}
