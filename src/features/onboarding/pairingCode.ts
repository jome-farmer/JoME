/** What the QR label on a JoME controller encodes (jome-farmer/protocol §10). */
export type PairingCode = { serial: string; passkey: string };

const SERIAL = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;
const PASSKEY = /^\d{6}$/;

/** A factory label serial (`JM-…`). Boards that were never provisioned report a dev serial like `shambe-a1b2c3`. */
export function isLabelSerial(serial: string): boolean {
  return SERIAL.test(serial);
}

/** `jome://pair?s=JM-2024-0001&k=483920` → { serial, passkey }, or null for anything else. */
export function parsePairingCode(text: string): PairingCode | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  // Non-special schemes parse "pair" as the host in some engines and as the path in others.
  const target = (url.host || url.pathname.replace(/^\/+/, "")).toLowerCase();
  if (url.protocol !== "jome:" || target !== "pair") return null;
  const serial = url.searchParams.get("s")?.toUpperCase() ?? "";
  const passkey = url.searchParams.get("k") ?? "";
  return SERIAL.test(serial) && PASSKEY.test(passkey)
    ? { serial, passkey }
    : null;
}

/**
 * The BLE name a board advertises: `JoME-` + the last 4 characters of its serial.
 * Compare it case-insensitively: labels are upper case, today's serials (`shambe-a1b2c3`) aren't.
 */
export function advertisedName(serial: string): string {
  return `JoME-${serial.replace(/-/g, "").slice(-4)}`;
}

/** "483920" → "483 920", easier to read while typing it into the system dialog. */
export function formatPasskey(passkey: string): string {
  return `${passkey.slice(0, 3)} ${passkey.slice(3)}`;
}
