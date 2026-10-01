import { createContext, useContext } from "react";
import type { DeviceClient } from "../services/device/client";
import { offlineText } from "../services/device/errors";
import type { LinkKind } from "../services/device/links/link";
import type { Hello } from "../services/device/types";

export type ConnectionState = "idle" | "connecting" | "ready" | "lost";

export type DeviceContextValue = {
  state: ConnectionState;
  /** From `hello`; kept while `lost` so the UI can name the device. */
  info?: Hello;
  /** Set only when `ready`. */
  client?: DeviceClient;
  linkKind?: LinkKind;
  /** USB links only. */
  baudRate?: number;
  /**
   * Through the server only: set while the board itself is offline. Reads then
   * come from the server's cloud copy, last synced at `syncedAt` (epoch s), and
   * changes are refused (docs/architecture.md, Board offline).
   */
  offline?: { syncedAt?: number };
  /** Plain-language reason for the last failed connect or unexpected drop. */
  error?: string;
  connectDemo(): Promise<void>;
  /** deviceId from scanForJoME / pickJoME. */
  connectBle(deviceId: string): Promise<void>;
  /** Desktop Chrome/Edge: a port from pickSerialPort(). */
  connectWebSerial(port: SerialPort, baudRate?: number): Promise<void>;
  /** Android app: a deviceId from listUsbSerial(). */
  connectAndroidUsb(deviceId: number, baudRate?: number): Promise<void>;
  /** USB links only: reconnect the same port at another speed. */
  setBaudRate(baudRate: number): Promise<void>;
  /** Reconnect with the same kind of link as last time. */
  retry(): Promise<void>;
  /** device.reboot, then reconnect once the board is back (protocol §3). */
  restart(): Promise<void>;
  /** Rename the controller on the board, and update `info` and known devices to match. */
  rename(name: string): Promise<void>;
  /** `forget` also removes it from known devices, so it won't reconnect on next launch. */
  disconnect(options?: { forget?: boolean }): Promise<void>;
};

export const DeviceContext = createContext<DeviceContextValue | null>(null);

/**
 * While the board is offline through the server, controls that change it are
 * disabled: this is what a tap on one says. Undefined when changes can go through.
 */
export function useOfflineReason(): string | undefined {
  const { offline, info } = useDevice();
  return offline ? offlineText(info?.name ?? "JoME") : undefined;
}

export function useDevice(): DeviceContextValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice must be used inside <DeviceProvider>");
  return value;
}

/**
 * Whether the connected board accepts a command (protocol §3 hello.cmds).
 */
export function supports(info: Hello | undefined, cmd: string): boolean {
  return info?.cmds.includes(cmd) ?? false;
}
