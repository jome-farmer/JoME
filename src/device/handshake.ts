import { DeviceError, type DeviceClient } from "./client";
import { PROTOCOL_VERSION, type Hello } from "./types";

/** Runs on every connect: identify the board, refuse other protocol versions, set its clock. */
export async function handshake(
  client: DeviceClient,
  now = new Date(),
): Promise<Hello> {
  const hello = await client.request("hello", {});
  if (hello.proto !== PROTOCOL_VERSION) {
    throw new DeviceError(
      "BAD_REQUEST",
      hello.proto > PROTOCOL_VERSION
        ? "This JoME has newer firmware than the app understands. Update the app."
        : "This JoME has older firmware. Update it before connecting.",
    );
  }
  await client.request("time.set", {
    epoch: Math.floor(now.getTime() / 1000),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return hello;
}
