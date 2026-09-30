import type { WifiNetwork } from "../../device/types";

/** One row per network name, keeping the strongest signal, strongest first. Hidden (empty) names dropped. */
export function networkList(scan: WifiNetwork[]): WifiNetwork[] {
  const best = new Map<string, WifiNetwork>();
  for (const n of scan) {
    if (!n.ssid) continue;
    const seen = best.get(n.ssid);
    if (!seen || n.rssi > seen.rssi) best.set(n.ssid, n);
  }
  return [...best.values()].sort((a, b) => b.rssi - a.rssi);
}

/** WPA/WPA2/WPA3 passphrases are 8–63 characters; open networks need none. */
export function passwordProblem(
  network: WifiNetwork,
  password: string,
): string | undefined {
  if (!network.secure) return undefined;
  if (password.length < 8) return "Wi‑Fi passwords are at least 8 characters.";
  if (password.length > 63) return "Wi‑Fi passwords are at most 63 characters.";
  return undefined;
}

/** The board reports ESP-IDF reason codes (protocol §5 WifiState); say what they mean. */
export function wifiFailureText(reason: string | undefined): string {
  switch (reason) {
    case "AUTH_FAIL":
    case "AUTH_EXPIRE":
    case "4WAY_HANDSHAKE_TIMEOUT":
    case "HANDSHAKE_TIMEOUT":
      return "Couldn't join: wrong password. Check it and try again.";
    case "NO_AP_FOUND":
      return "Couldn't join: JoME can't see this network. Move the router or the controller closer.";
    case undefined:
      return "Couldn't join. Check the password and try again.";
    default:
      return `Couldn't join (${reason}). Try again.`;
  }
}
