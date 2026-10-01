/** The account's boards on DouSHamBE (docs/cloud.md, Devices). */

import { api, followEvents } from "./client";

/** One part of the cloud copy: the board's `data` for a read command, and when it was read (epoch s). */
export type CopyPart = { data: unknown; syncedAt: number };

/** A board on the account, with the server's cloud copy of its state. */
export type CloudDevice = {
  serial: string;
  name: string;
  online: boolean;
  lastSeen?: number;
  claimedAt?: number;
  state?: Partial<Record<string, CopyPart>>;
};

/** What a claim returns once: the board's own broker login, for `server.set` (#96). */
export type Claimed = {
  serial: string;
  mqtt: { host: string; port: number; username: string; password: string };
};

const path = (serial: string) => `/v1/devices/${encodeURIComponent(serial)}`;

/** The account's boards, each with its cloud copy. Works while boards are offline. */
export function listDevices(): Promise<CloudDevice[]> {
  return api<CloudDevice[]>("/v1/devices");
}

export function getDevice(
  serial: string,
  signal?: AbortSignal,
): Promise<CloudDevice> {
  return api<CloudDevice>(path(serial), { signal });
}

/** Add a board to the account with the code on its label. */
export function claimDevice(serial: string, code: string): Promise<Claimed> {
  return api<Claimed>("/v1/devices/claim", {
    method: "POST",
    body: { serial, code },
  });
}

/** Send one protocol command; resolves to the board's `data`. */
export async function sendCommand(
  serial: string,
  cmd: unknown,
  args: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const { data } = await api<{ data?: unknown }>(`${path(serial)}/commands`, {
    method: "POST",
    body: { cmd, args },
    signal,
  });
  return data ?? {};
}

/** The board's live events (and `online`), until `signal` aborts. */
export function followDeviceEvents(
  serial: string,
  handlers: Parameters<typeof followEvents>[1],
  signal: AbortSignal,
): void {
  followEvents(`${path(serial)}/events/stream`, handlers, signal);
}
