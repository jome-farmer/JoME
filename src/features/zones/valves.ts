import type { Zone } from "../../device/types";

export type ValveOption = { valve: number; takenBy?: string };

/** Boards that don't report valveCount: assume 8, or more if zones already use higher valves. */
export function valveCountOf(
  reported: number | undefined,
  zones: Zone[],
): number {
  return reported ?? Math.max(8, ...zones.map((z) => z.valve));
}

/** Every valve 1…count, with the name of the zone using it. `self` doesn't count as taken. */
export function valveOptions(
  count: number,
  zones: Zone[],
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
