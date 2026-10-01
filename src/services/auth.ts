/** Accounts and sign-in on DouSHamBE (docs/cloud.md, Sign-in). */

import { api } from "./client";

/** A way to sign in to the account. */
export type Identity = { type: "phone" | "email" | "google"; id: string };

export type User = {
  id: string;
  role: string;
  name: string | null;
  identities: Identity[];
};

/** What `/v1/auth/*` returns. `created` means the account is new. */
export type Session = {
  accessToken: string;
  user: User;
  created: boolean;
};

/** Where the sign-in code goes: an Iranian mobile in E.164 (+989…), or an email address. */
export type Channel = "phone" | "email";
export type CodeTarget = { channel: Channel; to: string };

/** Send a 6-digit code. One per minute; it lasts 5 minutes. */
export function startCode({ channel, to }: CodeTarget): Promise<unknown> {
  return api("/v1/auth/otp/start", { method: "POST", body: { channel, to } });
}

/** The same call signs up and signs in; `created` says which. */
export function verifyCode(
  { channel, to }: CodeTarget,
  code: string,
): Promise<Session> {
  return api<Session>("/v1/auth/otp/verify", {
    method: "POST",
    body: { channel, to, code },
  });
}

/** Google's ID token for a session; the same call signs up and signs in. */
export function verifyGoogle(
  idToken: string,
  nonce?: string,
): Promise<Session> {
  return api<Session>("/v1/auth/google", {
    method: "POST",
    body: { idToken, nonce },
  });
}

/** The signed-in account. */
export function getMe(): Promise<User> {
  return api<User>("/v1/me");
}
