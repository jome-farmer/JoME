import { serverStateText } from "../../services/device/serverLink";
import type { LinkKind } from "../../services/device/links/link";
import type { ServerState } from "../../services/device/types";

/** What the Device tab says about the board's link to JoME's server. */
export type ServerRow = {
  /** The short word on the row. */
  value: string;
  /** The sentence in the sheet. */
  text: string;
  /** Needs the person's attention (shown as a subtitle on the row). */
  attention: boolean;
  /** Offer to run the registration again. */
  canConnect: boolean;
};

const VALUE: Record<ServerState["state"], string> = {
  registering: "Registering…",
  registered: "Registered",
  connecting: "Connecting…",
  online: "Online",
  failed: "Needs attention",
};

/**
 * The row for the connected board, or nothing when it has no server (the demo).
 *
 * Through the internet the answer is already known: the app is talking to the
 * board via the server. Over Bluetooth or USB the board reports `server.state`
 * only when it changes, so until it does, the state is unknown, and
 * `canRegister` (signed in, firmware with `server.set`) decides whether to
 * offer connecting it.
 */
export function serverRow({
  linkKind,
  offline,
  server,
  canRegister,
}: {
  linkKind: LinkKind;
  offline: boolean;
  server?: ServerState;
  canRegister: boolean;
}): ServerRow | undefined {
  if (linkKind === "mock") return undefined;
  if (linkKind === "cloud") {
    return offline
      ? {
          value: "Offline",
          text: "JoME isn't connected to the server right now. It reconnects on its own when its Wi‑Fi is back.",
          attention: false,
          canConnect: false,
        }
      : {
          value: "Online",
          text: "JoME is connected to the server.",
          attention: false,
          canConnect: false,
        };
  }
  if (!server) {
    return {
      value: "Not reported",
      text: "JoME hasn't said whether it is connected to the server since you connected. You can connect it again.",
      attention: false,
      canConnect: canRegister,
    };
  }
  return {
    value: VALUE[server.state],
    text: serverStateText(server),
    attention: server.state === "failed",
    canConnect: canRegister && server.state !== "registering",
  };
}
