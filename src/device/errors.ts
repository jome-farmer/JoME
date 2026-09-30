import { DeviceError } from "./client";

/**
 * What the app says for each error code. The board's `message` is English for
 * developers and logs (protocol §2); people see this instead.
 */
const TEXT: Record<string, string> = {
  BAD_REQUEST: "JoME didn't accept that. Check the values and try again.",
  UNKNOWN_CMD: "This controller's firmware doesn't support that yet.",
  NOT_FOUND: "That zone or program doesn't exist any more.",
  ZONE_BUSY:
    "Another zone is watering. Stop it first, or wait until it finishes.",
  ZONE_DISABLED: "That zone is turned off. Turn it on first.",
  CLOCK_NOT_SET:
    "JoME doesn't know the time yet. Reconnect so the app can set its clock.",
  WIFI_FAILED: "JoME's Wi‑Fi radio couldn't do that. Try again.",
  VALVE_IN_USE: "Another zone already uses that valve.",
  INTERNAL: "JoME hit a problem. Try again.",
  TIMEOUT: "JoME didn't answer. Check it's nearby and try again.",
  LINK_CLOSED: "The connection to JoME closed.",
  NO_DEVICE: "Connect to your JoME first.",
};

/** Plain words for any error thrown by the device layer. Unknown codes stay generic (protocol §6). */
export function errorText(e: unknown): string {
  if (e instanceof DeviceError)
    return TEXT[e.code] ?? `Something went wrong (${e.code}).`;
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && TEXT[code]) return TEXT[code];
  return e instanceof Error ? e.message : String(e);
}
