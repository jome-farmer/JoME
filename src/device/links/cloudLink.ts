import { ApiError } from "../../service/client";
import {
  followDeviceEvents,
  getDevice,
  sendCommand,
  type CloudDevice,
} from "../../service/devices";
import { DeviceError } from "../client";
import { encodeLine, LineDecoder } from "../lineCodec";
import type { Link } from "../link";

/** Whether the board itself is reachable, and how old the copy is (epoch s) when it isn't. */
export type Presence = { online: boolean; syncedAt?: number };

export interface CloudLink extends Link {
  readonly kind: "cloud";
  presence(): Presence;
  /** Fires when the board goes offline or comes back. */
  onPresence(cb: (p: Presence) => void): () => void;
}

/** Reads the copy can answer while the board is offline, and the part that holds each. */
const COPY: Record<string, string> = {
  hello: "hello",
  status: "status",
  "zones.list": "zones",
  "programs.list": "programs",
  "sensors.read": "sensors",
  "usage.read": "usage",
};

/**
 * The board through DouSHamBE (docs/architecture.md, Cloud link). A request
 * line becomes `POST /commands` and its reply comes back as a response line
 * with the same id; the event stream becomes event lines.
 *
 * While the board is offline the link stays open: reads are answered from the
 * server's cloud copy as they were at the last sync, and changes are refused
 * with DEVICE_OFFLINE straight away (the server never queues them).
 */
export function createCloudLink(serial: string): CloudLink {
  const decoder = new LineDecoder();
  const dataSubs = new Set<(bytes: Uint8Array) => void>();
  const closeSubs = new Set<(error?: Error) => void>();
  const presenceSubs = new Set<(p: Presence) => void>();
  // Set while open; aborting it stops the event stream and requests in flight.
  let live: AbortController | undefined;
  let device: CloudDevice | undefined;

  const presence = (): Presence => {
    if (!device || device.online) return { online: true };
    const times = Object.values(device.state ?? {}).map(
      (p) => p?.syncedAt ?? 0,
    );
    return { online: false, syncedAt: Math.max(0, ...times) || undefined };
  };
  const setDevice = (next: CloudDevice) => {
    const was = device?.online;
    device = next;
    if (was !== undefined && was !== next.online)
      presenceSubs.forEach((cb) => cb(presence()));
  };
  /** Read the board's record again: whether it's online, and a fresh copy. */
  const sync = async () => setDevice(await getDevice(serial, live?.signal));

  const emit = (text: string) => {
    if (!live) return;
    const bytes = encodeLine(text);
    dataSubs.forEach((cb) => cb(bytes));
  };
  const reply = (id: unknown, data: unknown) =>
    emit(JSON.stringify({ id, ok: true, data }));
  const fail = (id: unknown, code: string, message: string) =>
    emit(JSON.stringify({ id, ok: false, error: { code, message } }));
  const close = (error?: Error) => {
    if (!live) return;
    live.abort();
    live = undefined;
    closeSubs.forEach((cb) => cb(error));
  };

  const fromCopy = (id: unknown, cmd: unknown) => {
    const data = device?.state?.[COPY[String(cmd)] ?? ""]?.data;
    if (data !== undefined) return reply(id, data);
    fail(
      id,
      "DEVICE_OFFLINE",
      `${device?.name ?? "JoME"} is offline. Changes need it online.`,
    );
  };

  const request = async (id: unknown, cmd: unknown, args: unknown) => {
    if (device && !device.online) return fromCopy(id, cmd);
    const signal = live?.signal;
    try {
      reply(id, await sendCommand(serial, cmd, args, signal));
    } catch (e) {
      if (signal?.aborted) return;
      const code = e instanceof ApiError ? e.code : "INTERNAL";
      // It went offline before the stream said so: switch to the copy now.
      if (code === "DEVICE_OFFLINE") {
        await sync().catch(() => undefined);
        if (device && !device.online) return fromCopy(id, cmd);
      }
      // Server codes (TIMEOUT, FORBIDDEN_REMOTE…) and the board's own pass through as protocol errors.
      fail(id, code, e instanceof Error ? e.message : String(e));
    }
  };

  return {
    kind: "cloud",
    peerId: serial,
    presence,
    onPresence(cb) {
      presenceSubs.add(cb);
      return () => presenceSubs.delete(cb);
    },
    async open() {
      // Checks the board is on this account; online or not, the link opens.
      device = await getDevice(serial);
      live = new AbortController();
      let reconnect = false;
      followDeviceEvents(
        serial,
        {
          // After a dropped stream, catch up on what was missed (docs/cloud.md).
          onOpen: () => {
            if (reconnect) void sync().catch(() => undefined);
            reconnect = true;
          },
          onEvent: ({ event, data }) => {
            const payload = (data as { data?: unknown } | null)?.data;
            if (event !== "online")
              return emit(JSON.stringify({ evt: event, data: payload }));
            // Gone: fetch the copy as the board left it. Back: talk to it again.
            if (payload === false) void sync().catch(() => undefined);
            else if (device) setDevice({ ...device, online: true });
          },
          // Signed out, or the board left this account.
          onError: (e) => close(e),
        },
        live.signal,
      );
    },
    async close() {
      close();
    },
    async write(bytes) {
      if (!live)
        throw new DeviceError(
          "LINK_CLOSED",
          "Not connected through the internet",
        );
      for (const line of decoder.push(bytes)) {
        if (line.kind === "msg")
          void request(line.msg.id, line.msg.cmd, line.msg.args);
        // The firmware's own text commands and logs only exist over BLE and USB.
        else
          emit(
            "E (cloud) Text commands need the phone nearby: connect over Bluetooth or USB.",
          );
      }
    },
    onData(cb) {
      dataSubs.add(cb);
      return () => dataSubs.delete(cb);
    },
    onClose(cb) {
      closeSubs.add(cb);
      return () => closeSubs.delete(cb);
    },
  };
}
