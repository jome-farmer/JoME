import { createContext, useContext } from "react";
import type { DeviceClient } from "./client";
import type { LinkKind } from "./link";
import type { Hello } from "./types";

export type ConnectionState = "idle" | "connecting" | "ready" | "lost";

export type DeviceContextValue = {
  state: ConnectionState;
  /** From `hello`; kept while `lost` so the UI can name the device. */
  info?: Hello;
  /** Set only when `ready`. */
  client?: DeviceClient;
  linkKind?: LinkKind;
  /** Plain-language reason for the last failed connect or unexpected drop. */
  error?: string;
  connectDemo(): Promise<void>;
  /** deviceId from scanForJoME / pickJoME. */
  connectBle(deviceId: string): Promise<void>;
  /** Reconnect with the same kind of link as last time. */
  retry(): Promise<void>;
  /** `forget` also removes it from known devices, so it won't reconnect on next launch. */
  disconnect(options?: { forget?: boolean }): Promise<void>;
};

export const DeviceContext = createContext<DeviceContextValue | null>(null);

export function useDevice(): DeviceContextValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice must be used inside <DeviceProvider>");
  return value;
}
