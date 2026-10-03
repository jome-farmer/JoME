/** Sharing a board (docs/cloud.md, Sharing): invitations by identity, members, leaving. */

import { api } from "./client";

export type Member = {
  userId: string;
  /** What they were invited as, if known. */
  identity: string | null;
  addedAt: number;
};

/** Waiting for the invitee to sign in with that identity and accept. */
export type Invite = {
  id: string;
  identity: string;
  invitedAt: number;
  expiresAt: number;
};

export type Shares = { members: Member[]; invites: Invite[] };

/** An invitation for the signed-in account. */
export type PendingInvite = {
  id: string;
  serial: string;
  /** The board's name. */
  device: string | null;
  /** Who invited. */
  inviter: string | null;
  expiresAt: number;
};

const board = (serial: string) =>
  `/v1/devices/${encodeURIComponent(serial)}/shares`;

/** Owner: invite `identity` (`email:…` or `phone:+98…`, see toShareIdentity). */
export function inviteTo(serial: string, identity: string): Promise<Invite> {
  return api<Invite>(board(serial), { method: "POST", body: { identity } });
}

/** Owner: members and pending invitations. */
export function listShares(serial: string): Promise<Shares> {
  return api<Shares>(board(serial));
}

/**
 * Owner: remove a member or cancel an invitation (`target` is the member's
 * `userId` or the invitation's `id`). A member removes themselves with their
 * own user id.
 */
export function removeShare(serial: string, target: string): Promise<unknown> {
  return api(`${board(serial)}/${encodeURIComponent(target)}`, {
    method: "DELETE",
  });
}

/** Invitations for this account, once signed in with the invited identity. */
export function pendingInvites(): Promise<PendingInvite[]> {
  return api<PendingInvite[]>("/v1/shares/invites");
}

export function acceptInvite(id: string): Promise<{ serial: string }> {
  return api<{ serial: string }>(
    `/v1/shares/invites/${encodeURIComponent(id)}/accept`,
    { method: "POST" },
  );
}

export function declineInvite(id: string): Promise<unknown> {
  return api(`/v1/shares/invites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
