import { formatDuration } from "../../lib/format";
import type { Zone } from "../../services/device/types";

/** Compact zone list for the terminal, using the same duration wording as the app. */
export function formatZones(zones: Zone[]): string {
  if (!zones.length) return "Zones: none";
  return `Zones:\n${zones
    .map(
      (zone) =>
        `${zone.zone}. ${zone.name} · ${zone.enabled ? "on" : "off"} · ${formatDuration(zone.defaultSeconds)}${zone.valve ? ` · valve ${zone.valve}` : ""}`,
    )
    .join("\n")}`;
}
