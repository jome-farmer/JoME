import type { WifiState } from "../../services/device/types";

/** The terminal's compact, human-readable view of the controller Wi-Fi state. */
export function formatWifiState(wifi: WifiState): string {
  if (wifi.state === "connected")
    return `Wi-Fi: connected${wifi.ssid ? ` to ${wifi.ssid}` : ""}${wifi.ip ? ` · ${wifi.ip}` : ""}`;
  if (wifi.state === "connecting")
    return `Wi-Fi: connecting${wifi.ssid ? ` to ${wifi.ssid}` : ""}`;
  if (wifi.state === "failed")
    return `Wi-Fi: failed${wifi.reason ? ` · ${wifi.reason}` : ""}`;
  return "Wi-Fi: disconnected";
}
