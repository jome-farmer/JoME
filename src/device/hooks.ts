import { offlineText } from "../services/device/errors";
import type { DeviceClient } from "../services/device/client";
import type { Hello } from "../services/device/types";
import { useAppSelector } from "../store";
import { getClient } from "../store/connection";
import { selectDevice } from "../store/deviceSlice";

/** The client of the open connection, only while `ready`. */
export function useDeviceClient(): DeviceClient | undefined {
  // Every new connection passes through `connecting`, so this re-renders with each new client.
  const ready = useAppSelector((s) => s.device.state === "ready");
  return ready ? getClient() : undefined;
}

/**
 * While the board is offline through the server, controls that change it are
 * disabled: this is what a tap on one says. Undefined when changes can go through.
 */
export function useOfflineReason(): string | undefined {
  const { offline, info } = useAppSelector(selectDevice);
  return offline ? offlineText(info?.name ?? "JoME") : undefined;
}

/** Whether the connected board accepts a command (protocol §3 hello.cmds). */
export function supports(info: Hello | undefined, cmd: string): boolean {
  return info?.cmds.includes(cmd) ?? false;
}
