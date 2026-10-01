import { ApiError, api, followEvents } from "../../lib/api";
import { DeviceError } from "../client";
import { encodeLine, LineDecoder } from "../lineCodec";
import type { Link } from "../link";

/** The parts of `GET /v1/devices/{serial}` the link needs (docs/cloud.md). */
type CloudDevice = { serial: string; name: string; online: boolean };

/**
 * The board through DouSHamBE (docs/architecture.md, Cloud link). A request
 * line becomes `POST /commands` and its reply comes back as a response line
 * with the same id; the event stream becomes event lines. The board going
 * offline (`online: false`) closes the link with an error, like a dropped radio.
 */
export function createCloudLink(serial: string): Link {
  const path = `/v1/devices/${encodeURIComponent(serial)}`;
  const decoder = new LineDecoder();
  const dataSubs = new Set<(bytes: Uint8Array) => void>();
  const closeSubs = new Set<(error?: Error) => void>();
  // Set while open; aborting it stops the event stream and requests in flight.
  let live: AbortController | undefined;

  const emit = (text: string) => {
    if (!live) return;
    const bytes = encodeLine(text);
    dataSubs.forEach((cb) => cb(bytes));
  };
  const close = (error?: Error) => {
    if (!live) return;
    live.abort();
    live = undefined;
    closeSubs.forEach((cb) => cb(error));
  };

  const request = async (id: unknown, cmd: unknown, args: unknown) => {
    const signal = live?.signal;
    try {
      const { data } = await api<{ data?: unknown }>(`${path}/commands`, {
        method: "POST",
        body: { cmd, args },
        signal,
      });
      emit(JSON.stringify({ id, ok: true, data: data ?? {} }));
    } catch (e) {
      if (signal?.aborted) return;
      // Server codes (DEVICE_OFFLINE, TIMEOUT, FORBIDDEN_REMOTE…) and the board's own pass through as protocol errors.
      const code = e instanceof ApiError ? e.code : "INTERNAL";
      const message = e instanceof Error ? e.message : String(e);
      emit(JSON.stringify({ id, ok: false, error: { code, message } }));
    }
  };

  return {
    kind: "cloud",
    peerId: serial,
    async open() {
      const device = await api<CloudDevice>(path);
      if (!device.online)
        throw new DeviceError(
          "DEVICE_OFFLINE",
          `${device.name} is offline. It comes back when it's on Wi‑Fi again.`,
        );
      live = new AbortController();
      followEvents(
        `${path}/events/stream`,
        {
          onEvent: ({ event, data }) => {
            const payload = (data as { data?: unknown } | null)?.data;
            if (event !== "online")
              emit(JSON.stringify({ evt: event, data: payload }));
            else if (payload === false)
              close(
                new DeviceError(
                  "DEVICE_OFFLINE",
                  `${device.name} went offline.`,
                ),
              );
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
