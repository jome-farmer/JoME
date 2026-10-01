import { latinDigits } from "../../lib/format";

/** Codes are 6 digits. The server allows 5 wrong tries per code. */
export const CODE_LENGTH = 6;
export const MAX_TRIES = 5;
/** One code per minute. */
export const RESEND_MS = 60_000;

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
