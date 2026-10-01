import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  addKnownDevices,
  forgetDevice,
  getKnownDevices,
  rememberDevice,
} from "../lib/storage";
import { listDevices } from "../services/devices";
import { DeviceClient } from "../services/device/client";
import { handshake } from "../services/device/handshake";
import type { Link, LinkKind } from "../services/device/links/link";
import { canScanInApp, createBleLink } from "../services/device/links/bleLink";
import { createAndroidUsbLink } from "../services/device/links/androidUsbLink";
import {
  createCloudLink,
  type CloudLink,
} from "../services/device/links/cloudLink";
import { createMockLink } from "../services/device/links/mockLink";
import { createWebSerialLink } from "../services/device/links/webSerialLink";
import type { Hello } from "../services/device/types";
import type { AuthState } from "./authSlice";
import { conn, teardown } from "./connection";
import type { AppThunk, RootState } from ".";

export type ConnectionState = "idle" | "connecting" | "ready" | "lost";

export type DeviceState = {
  state: ConnectionState;
  /** From `hello`; kept while `lost` so the UI can name the device. */
  info?: Hello;
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
};

const initialState: DeviceState = { state: "idle" };

const deviceSlice = createSlice({
  name: "device",
  initialState,
  reducers: {
    connecting: (s, { payload }: PayloadAction<LinkKind>): DeviceState => ({
      state: "connecting",
      linkKind: payload,
      info: s.info,
    }),
    ready: (_, { payload }: PayloadAction<Omit<DeviceState, "state">>) => ({
      state: "ready" as const,
      ...payload,
    }),
    /** The link closed on its own: `lost` with an error, `idle` without. */
    dropped: (
      s,
      { payload }: PayloadAction<{ linkKind: LinkKind; error?: string }>,
    ): DeviceState => ({
      state: payload.error ? "lost" : "idle",
      info: s.info,
      ...payload,
    }),
    failed: (
      _,
      { payload }: PayloadAction<{ linkKind: LinkKind; error: string }>,
    ): DeviceState => ({ state: "idle", ...payload }),
    /** A reconnect didn't work: still lost, still named, same reason. */
    reconnectFailed: (s): DeviceState => ({
      state: "lost",
      info: s.info,
      linkKind: s.linkKind,
      error: s.error,
    }),
    offlineChanged: (s, { payload }: PayloadAction<DeviceState["offline"]>) => {
      s.offline = payload;
    },
    renamed: (s, { payload }: PayloadAction<string>) => {
      if (s.info) s.info.name = payload;
    },
    closed: (): DeviceState => ({ state: "idle" }),
  },
});

export const deviceReducer = deviceSlice.reducer;
/** For gardenSlice: a new board, or none, means another garden. */
export const { ready: deviceReady, closed: deviceClosed } = deviceSlice.actions;
const {
  connecting,
  ready,
  dropped,
  failed,
  reconnectFailed,
  offlineChanged,
  renamed,
  closed,
} = deviceSlice.actions;

export const selectDevice = (s: RootState) => s.device;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Open → handshake → ready, and what happens when the link drops. */
const connect =
  (
    factory: () => Link,
    { reconnecting = false } = {},
  ): AppThunk<Promise<void>> =>
  async (dispatch) => {
    await teardown();
    conn.lastFactory = factory;
    const link = factory();
    dispatch(connecting(link.kind));
    try {
      await link.open();
      const client = new DeviceClient(link);
      // The demo reuses one link across reconnects, so this handler must go when the connection does.
      const offClose = link.onClose((err) => {
        if (conn.active?.link !== link) return; // We closed it on purpose.
        conn.active = null;
        offClose();
        client.dispose();
        dispatch(
          dropped({
            linkKind: link.kind,
            // The cloud says why (signed out, board removed); a radio just drops.
            error:
              err &&
              (link.kind === "cloud"
                ? err.message
                : "The connection to JoME was lost."),
          }),
        );
      });
      // Through the server, the board can be offline while the link stays up (screens show the cloud copy).
      const cloud = link.kind === "cloud" ? (link as CloudLink) : undefined;
      const offline = () => {
        const p = cloud?.presence();
        return p && !p.online ? { syncedAt: p.syncedAt } : undefined;
      };
      cloud?.onPresence(() => {
        if (conn.active?.link === link) dispatch(offlineChanged(offline()));
      });
      conn.active = { link, client, offClose };
      const info = await handshake(client, {
        setClock: link.kind !== "cloud",
      });
      const known = (await getKnownDevices()).find(
        (d) => d.serial === info.serial,
      );
      await rememberDevice({
        serial: info.serial,
        name: info.name,
        lastLink: link.kind,
        // Keep the Bluetooth peer when connecting another way: it's the way back when the internet isn't.
        bleDeviceId: link.kind === "ble" ? link.peerId : known?.bleDeviceId,
        lastSeen: Date.now(),
      });
      dispatch(
        ready({
          info,
          linkKind: link.kind,
          baudRate: link.baudRate,
          offline: offline(),
        }),
      );
    } catch (e) {
      await teardown();
      await link.close().catch(() => {});
      dispatch(
        reconnecting
          ? reconnectFailed()
          : failed({
              linkKind: link.kind,
              error: `Couldn't connect to JoME. ${message(e)}`,
            }),
      );
    }
  };

export const connectDemo = () =>
  connect(() => (conn.demoLink ??= createMockLink()));

/** deviceId from scanForJoME / pickJoME. */
export const connectBle = (deviceId: string) =>
  connect(() => createBleLink(deviceId));

const connectCloud = (serial: string) => connect(() => createCloudLink(serial));

const connectSerial = (
  make: (baudRate?: number) => Link,
  baudRate?: number,
) => {
  conn.serial = make;
  return connect(() => make(baudRate));
};

/** Desktop Chrome/Edge: a port from pickSerialPort(). */
export const connectWebSerial = (port: SerialPort, baudRate?: number) =>
  connectSerial((b) => createWebSerialLink(port, b), baudRate);

/** Android app: a deviceId from listUsbSerial(). */
export const connectAndroidUsb = (deviceId: number, baudRate?: number) =>
  connectSerial((b) => createAndroidUsbLink(deviceId, b), baudRate);

/** USB links only: reconnect the same port at another speed. */
export const setBaudRate =
  (baudRate: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const make = conn.serial;
    if (make && getState().device.linkKind === "usb")
      await dispatch(connect(() => make(baudRate)));
  };

/** Reconnect with the same kind of link as last time. */
export const retry =
  ({ reconnecting = false } = {}): AppThunk<Promise<void>> =>
  async (dispatch) => {
    if (conn.lastFactory)
      await dispatch(connect(conn.lastFactory, { reconnecting }));
  };

/** device.reboot, then reconnect once the board is back (protocol §3). */
export const restart = (): AppThunk<Promise<void>> => async (dispatch) => {
  const current = conn.active;
  const factory = conn.lastFactory;
  if (!current || !factory) throw new Error("Not connected");
  const kind = current.link.kind;
  await current.client.request("device.reboot", {});
  // Bluetooth reconnects on its own with backoff; other links need a nudge once the board has booted.
  if (kind === "ble") return;
  await new Promise((r) => setTimeout(r, 3000));
  await dispatch(connect(factory, { reconnecting: true }));
};

/** Rename the controller on the board, and update `info` and known devices to match. */
export const rename =
  (name: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { info, linkKind } = getState().device;
    const client = conn.active?.client;
    if (!client || !info || !linkKind) throw new Error("Not connected");
    await client.request("device.rename", { name });
    const known = (await getKnownDevices()).find(
      (d) => d.serial === info.serial,
    );
    await rememberDevice({
      serial: info.serial,
      name,
      lastLink: linkKind,
      bleDeviceId: known?.bleDeviceId,
      lastSeen: Date.now(),
    });
    dispatch(renamed(name));
  };

/** `forget` also removes it from known devices, so it won't reconnect on next launch. */
export const disconnect =
  ({ forget = false } = {}): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { info, linkKind } = getState().device;
    await teardown();
    if (forget && linkKind === "mock") conn.demoLink = null;
    if (forget && info) await forgetDevice(info.serial);
    dispatch(closed());
  };

/**
 * Which link to open without being asked (docs/architecture.md, Choosing a link): the demo if
 * that's where they left off; the server for a board on the account; otherwise Bluetooth to the
 * last board, in native apps only (browsers need a tap first). Runs at launch and on sign-in.
 */
export const autoConnect =
  (auth: AuthState, { launch }: { launch: boolean }): AppThunk<Promise<void>> =>
  async (dispatch) => {
    if (auth === "signedOut" && !launch) {
      // The server needs the account, so signing out ends a connection through it.
      if (conn.active?.link.kind === "cloud") {
        await teardown();
        dispatch(closed());
      }
      return;
    }
    if (conn.active) return; // Already connected, e.g. nearby during setup.
    const before = conn.lastFactory;
    const [last] = await getKnownDevices();
    const signedIn = auth === "signedIn";
    // The account's boards join this phone's list, so a new phone knows them too.
    const list = signedIn ? listDevices().catch(() => []) : Promise.resolve([]);
    // Someone connected by hand meanwhile: leave theirs alone.
    if (conn.lastFactory !== before) return;
    if (last?.lastLink === "mock") return void dispatch(connectDemo());
    // Last time it was through the server: go straight there (opening checks it's still ours).
    // The list is merged after connecting, so the two writes to known devices don't race.
    if (signedIn && last?.lastLink === "cloud")
      return void dispatch(connectCloud(last.serial))
        .then(() => list)
        .then(addKnownDevices);
    const boards = await list;
    await addKnownDevices(boards);
    if (conn.lastFactory !== before) return;
    const board = last
      ? boards.find((b) => b.serial === last.serial)
      : boards[0];
    if (board) return void dispatch(connectCloud(board.serial));
    if (launch && last?.bleDeviceId && canScanInApp())
      void dispatch(connectBle(last.bleDeviceId));
  };
