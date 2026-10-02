import { DeviceError } from "./client";

/** Why a change is refused while the board is offline (design/README.md, Board offline). */
export function offlineText(name: string): string {
  return `Changes need ${name} online. It reconnects on its own when its Wi‑Fi is back.`;
}

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
  NO_NETWORK:
    "JoME isn't connected to Wi‑Fi yet. Connect it to your network first.",
  WIFI_FAILED: "JoME's Wi‑Fi radio couldn't do that. Try again.",
  VALVE_IN_USE: "Another zone already uses that valve.",
  INTERNAL: "JoME hit a problem. Try again.",
  TIMEOUT: "JoME didn't answer. Check it's nearby and try again.",
  LINK_CLOSED: "The connection to JoME closed.",
  NO_DEVICE: "Connect to your JoME first.",
  // From the server (docs/cloud.md).
  DEVICE_OFFLINE: offlineText("JoME"),
  FORBIDDEN_REMOTE:
    "That change needs the phone near JoME. Connect nearby from the Device tab.",
  NETWORK: "Couldn't reach JoME's server. Check your internet and try again.",
  UNAUTHORIZED: "You've been signed out. Sign in again.",
  CODE_INVALID: "That code didn't work. Check it or ask for a new one.",
  TOO_MANY_REQUESTS: "Wait a minute before asking for another code.",
  SEND_FAILED: "We couldn't send the code. Try again in a minute.",
  CLAIM_REJECTED: "That code doesn't match this JoME. Check the label.",
  ALREADY_CLAIMED:
    "This JoME belongs to another account. Ask its owner to remove it first.",
  CHANNEL_UNAVAILABLE:
    "Codes can't be sent that way right now. Try the other way, or try again later.",
};

/** Plain words for any error thrown by the device layer. Unknown codes stay generic (protocol §6). */
export function errorText(e: unknown): string {
  // cloudLink words this one for people already, with the board's name.
  if (e instanceof DeviceError && e.code === "DEVICE_OFFLINE" && e.message)
    return e.message;
  if (e instanceof DeviceError)
    return TEXT[e.code] ?? `Something went wrong (${e.code}).`;
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && TEXT[code]) return TEXT[code];
  return e instanceof Error ? e.message : String(e);
}
