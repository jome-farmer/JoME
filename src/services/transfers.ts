/** Handing a board to someone else, and removing it from the account (docs/cloud.md, Transfer). */

import { api, ApiError } from "./client";

/** The owner's outgoing offer: one per board, valid 7 days. */
export type Transfer = {
  id: string;
  identity: string;
  keepAccess: boolean;
  createdAt: number;
  expiresAt: number;
};

/** An offer for the signed-in account, once signed in with the identity it was made to. */
export type PendingTransfer = {
  id: string;
  serial: string;
  /** The board's name. */
  device: string | null;
  /** Who offers it. */
  owner: string | null;
  keepAccess: boolean;
  expiresAt: number;
};

const board = (serial: string) =>
  `/v1/devices/${encodeURIComponent(serial)}/transfer`;

/** Owner: offer the board to `identity` (`email:…` or `phone:+98…`, see toShareIdentity). */
export function offerBoard(
  serial: string,
  identity: string,
  keepAccess: boolean,
): Promise<Transfer> {
  return api<Transfer>(board(serial), {
    method: "POST",
    body: { identity, keepAccess },
  });
}

/** Owner: the pending offer, or undefined when there is none. */
export async function pendingOffer(
  serial: string,
): Promise<Transfer | undefined> {
  try {
    return await api<Transfer>(board(serial));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

/** Owner: withdraw the pending offer. */
export function cancelOffer(serial: string): Promise<unknown> {
  return api(board(serial), { method: "DELETE" });
}

/** Offers for this account. */
export function pendingTransfers(): Promise<PendingTransfer[]> {
  return api<PendingTransfer[]>("/v1/transfers");
}

export function acceptTransfer(id: string): Promise<{ serial: string }> {
  return api<{ serial: string }>(
    `/v1/transfers/${encodeURIComponent(id)}/accept`,
    { method: "POST" },
  );
}

export function declineTransfer(id: string): Promise<unknown> {
  return api(`/v1/transfers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Owner: remove the board from the account. The serial is repeated so a stray
 * call can't wipe a board; the board keeps its schedules and can be claimed
 * again by a new account.
 */
export function detachBoard(serial: string): Promise<unknown> {
  return api(
    `/v1/devices/${encodeURIComponent(serial)}?confirm=${encodeURIComponent(serial)}`,
    {
      method: "DELETE",
    },
  );
}
