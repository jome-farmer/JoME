import type { GardenZone } from "../../device/useGarden";

export type ValveOption = { valve: number; takenBy?: string };

/** Every valve 1…count, with the name of the zone using it. `self` doesn't count as taken. */
export function valveOptions(
  count: number,
  zones: GardenZone[],
  self?: number,
): ValveOption[] {
  return Array.from({ length: count }, (_, i) => {
    const valve = i + 1;
    const owner = zones.find((z) => z.valve === valve && z.zone !== self);
    return { valve, takenBy: owner?.name };
  });
}

export const firstFreeValve = (options: ValveOption[]) =>
  options.find((o) => !o.takenBy)?.valve;
