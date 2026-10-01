import type { Session } from "../../auth/AuthContext";
import { api } from "../../lib/api";

/** Where the sign-in code goes (docs/cloud.md, Sign-in). */
export type Channel = "phone" | "email";
export type CodeTarget = { channel: Channel; to: string };

/** Codes are 6 digits. The server allows 5 wrong tries per code. */
export const CODE_LENGTH = 6;
export const MAX_TRIES = 5;
/** One code per minute. */
export const RESEND_MS = 60_000;

/** Persian (۰–۹) and Arabic (٠–٩) digits → 0–9, as Iranian keyboards type them. */
export function latinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
}

/** An Iranian mobile however it's typed (0912…, 912…, +98 912…, 0098…) → "+989123456789", else null. */
export function toE164(input: string): string | null {
  const digits = latinDigits(input).replace(/[\s\-().]/g, "");
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `+98${m[1]}` : null;
}

/** Trimmed and lower-cased, or null when it isn't an email address. */
export function toEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

/** Keep only digits from typing or pasting ("483 920" → "483920"). */
export function codeDigits(text: string): string {
  return latinDigits(text).replace(/\D/g, "").slice(0, CODE_LENGTH);
}

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
