import { API_URL } from "../../services/client";
import { DeviceError, type DeviceClient } from "../../services/device/client";
import type { ServerState } from "../../services/device/types";
import { requestRegistrationToken } from "../../services/devices";

/** The board said `failed`, with the reason from `server.state`. */
export class RegistrationFailed extends Error {
  constructor(readonly reason: string) {
    super(`Registration failed: ${reason}`);
    this.name = "RegistrationFailed";
  }
}

/** Registering involves an HTTPS call and a TLS handshake on the board. */
export const REGISTRATION_TIMEOUT = 60_000;

type Options = {
  /** Tells the screen where the board is in the sequence. */
  onState?: (state: ServerState) => void;
  /** Injectable for tests. */
  requestToken?: () => Promise<{ token: string }>;
  apiUrl?: string;
  timeoutMs?: number;
};

/**
 * Gives the board a fresh registration token (`server.set`, local link only) and
 * waits until it reports `online`. Rejects with RegistrationFailed for a
 * `failed` event, with the board's DeviceError (NO_NETWORK, CLOCK_NOT_SET, …)
 * when it refuses the command, and with TIMEOUT when it goes quiet. A token is
 * single use, so every attempt asks for a new one; none is kept or logged.
 */
export async function registerBoard(
  client: DeviceClient,
  {
    onState,
    requestToken = requestRegistrationToken,
    apiUrl = API_URL,
    timeoutMs = REGISTRATION_TIMEOUT,
  }: Options = {},
): Promise<void> {
  const { token } = await requestToken();

  let off: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Listening starts before the command goes out: the first event can beat its reply.
  const outcome = new Promise<void>((resolve, reject) => {
    off = client.on("server.state", (s) => {
      onState?.(s);
      if (s.state === "online") resolve();
      else if (s.state === "failed")
        reject(new RegistrationFailed(s.reason ?? "UNKNOWN"));
    });
    timer = setTimeout(
      () =>
        reject(
          new DeviceError("TIMEOUT", "JoME didn't finish registering in time"),
        ),
      timeoutMs,
    );
  });
  // A reply error settles `outcome` below; avoid an unhandled rejection if it loses the race.
  outcome.catch(() => {});

  try {
    await client.request("server.set", { url: apiUrl, token });
    await outcome;
  } finally {
    off?.();
    clearTimeout(timer);
  }
}
