import type { Zone } from "../../device/types";

/** "1 running · 4 idle · 1 off", leaving out parts that are zero. */
export function zoneSummary(zones: Zone[], runningZone: number | null): string {
  const running = zones.filter((z) => z.zone === runningZone).length;
  const off = zones.filter((z) => !z.enabled).length;
  const idle = zones.length - running - off;
  const parts = [
    running && `${running} running`,
    idle && `${idle} idle`,
    off && `${off} off`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No zones yet";
}
