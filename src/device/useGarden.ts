import { useEffect, useState } from "react";
import type { Zone } from "../services/device/types";
import { useAppSelector } from "../store";
import { selectDevice } from "../store/deviceSlice";
import { selectGarden } from "../store/gardenSlice";
import { supports } from "./hooks";

export type GardenZone = Zone;

/**
 * The board as screens see it, from the one copy in the store (gardenSlice):
 * status, zones, programs, the running zone counted down to the second, and
 * sensors. Changes go through gardenSlice thunks.
 */
export function useGarden() {
  const { info, offline } = useAppSelector(selectDevice);
  const { status, zones, programs, run, sensors, error } =
    useAppSelector(selectGarden);
  const [now, setNow] = useState(() => Date.now());

  // One tick a second keeps the ring and the timeline moving between board reports.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Offline, the copy's run is history, not water flowing now (design: Board offline).
  const isOffline = offline !== undefined;
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
    sensors: supports(info, "sensors.read") ? sensors : undefined,
    error,
  };
}
