import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceClient } from "../../device/client";
import type { Program, Status, Zone } from "../../device/types";

export type Run = {
  zone: number;
  /** Seconds left when last reported by the board. */
  remaining: number;
  total: number;
  /** Date.now() of that report, so we can count down smoothly in between. */
  at: number;
};

/**
 * Home's live view of the board: status, zones, programs and the running zone.
 * ponytail: Home-only for now; move to a shared layer when Zones (#19) needs the same data.
 */
export function useHomeData(client: DeviceClient | undefined) {
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

  const remaining = run
    ? Math.max(0, run.remaining - (now - run.at) / 1000)
    : 0;

  return { status, zones, programs, run, remaining, now, error, refresh };
}
