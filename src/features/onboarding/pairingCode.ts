/** What the QR label on a JoME controller encodes (jome-farmer/protocol §10). */
export type PairingCode = { serial: string; passkey: string };

const SERIAL = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;
const PASSKEY = /^\d{6}$/;

/** A factory label serial (`JM-…`). Boards that were never provisioned report a dev serial like `shambe-a1b2c3`. */
export function isLabelSerial(serial: string): boolean {
  return SERIAL.test(serial);
}

/** The host of the label link (docs/deployment.md, App Links). `VITE_LINK_HOST` for a test host. */
export const LINK_HOST = (
  import.meta.env.VITE_LINK_HOST || "link.jome-farmer.ir"
).toLowerCase();

/**
 * What the label QR holds (jome-farmer/protocol §10), and what the app gets when the link opens it:
 * - `https://link.jome-farmer.ir/p?s=JM-2024-0001#pin=483920`, with the PIN in the fragment so no web server sees it;
 * - `jome://pair?s=JM-2024-0001&pin=483920`, the form the link page falls back to.
 * Anything else, including the old `k=` form, is null.
 */
export function parsePairingCode(
  text: string,
  linkHost: string = LINK_HOST,
): PairingCode | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  let pin: string | null;
  if (url.protocol === "https:") {
    if (url.hostname.toLowerCase() !== linkHost.toLowerCase()) return null;
    if (url.pathname.replace(/\/+$/, "") !== "/p") return null;
    pin = new URLSearchParams(url.hash.replace(/^#/, "")).get("pin");
  } else if (url.protocol === "jome:") {
    // Non-special schemes parse "pair" as the host in some engines and as the path in others.
    const target = (url.host || url.pathname.replace(/^\/+/, "")).toLowerCase();
    if (target !== "pair") return null;
    pin = url.searchParams.get("pin");
  } else {
    return null;
  }
  const serial = url.searchParams.get("s")?.toUpperCase() ?? "";
  return SERIAL.test(serial) && PASSKEY.test(pin ?? "")
    ? { serial, passkey: pin ?? "" }
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
