import type { DeviceClient } from "../services/device/client";
import type { Link } from "../services/device/links/link";

/**
 * The live connection, beside the store rather than in it: a Link and a
 * DeviceClient aren't serializable (ADR 0005). Only deviceSlice thunks write it.
 */
export const conn: {
  active: { link: Link; client: DeviceClient; offClose: () => void } | null;
  /** How the last connection was opened, for retry and reconnect. */
  lastFactory: (() => Link) | null;
  /**
   * One demo board per session, like a real board that keeps its settings across
   * reconnects and restarts. Exit demo (forget) starts the next demo fresh.
   */
  demoLink: Link | null;
  /** The open serial port, re-openable at another speed (terminal baud selector). */
  serial: ((baudRate?: number) => Link) | null;
} = { active: null, lastFactory: null, demoLink: null, serial: null };

/** The client of the open connection; deviceSlice says when it's ready. */
export function getClient(): DeviceClient | undefined {
  return conn.active?.client;
}

export async function teardown(): Promise<void> {
  const current = conn.active;
  conn.active = null; // Before close(), so its onClose isn't treated as a drop.
  if (!current) return;
  current.offClose();
  current.client.dispose();
  await current.link.close().catch(() => {});
}
