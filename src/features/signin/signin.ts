import { latinDigits } from "../../lib/format";

/**
 * Phone and email code sign-in needs SMS (Ghasedak) and SMTP on the server (docs/cloud.md).
 * Off until it has them: set `VITE_CODE_SIGNIN=true` to bring it back. The code stays.
 */
export const codeSignInEnabled = import.meta.env.VITE_CODE_SIGNIN === "true";

/** Codes are 6 digits. The server allows 5 wrong tries per code. */
export const CODE_LENGTH = 6;
export const MAX_TRIES = 5;
/** One code per minute. */
export const RESEND_MS = 60_000;

export { toE164, toEmail } from "../../lib/identity";

/** Keep only digits from typing or pasting ("483 920" → "483920"). */
export function codeDigits(text: string): string {
  return latinDigits(text).replace(/\D/g, "").slice(0, CODE_LENGTH);
}
