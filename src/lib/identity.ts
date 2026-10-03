import { displayPhone, latinDigits } from "./format";

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

/**
 * The server's name for someone you share with (`email:ali@example.com`,
 * `phone:+989123456789`): an email address or an Iranian mobile however it is
 * typed, or null when it is neither.
 */
export function toShareIdentity(input: string): string | null {
  const email = toEmail(input);
  if (email) return `email:${email}`;
  const phone = toE164(input);
  return phone ? `phone:${phone}` : null;
}

/** `email:ali@example.com` → `ali@example.com`, `phone:+98912…` → `0912 …`. */
export function identityLabel(identity: string | null | undefined): string {
  if (!identity) return "Someone";
  const [kind, ...rest] = identity.split(":");
  const value = rest.join(":");
  return kind === "phone" ? displayPhone(value) : value;
}
