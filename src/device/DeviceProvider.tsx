import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthState } from "../auth/AuthContext";
import { api } from "../lib/api";
import {
  addKnownDevices,
  forgetDevice,
  getKnownDevices,
  rememberDevice,
} from "../lib/storage";
import { DeviceClient } from "./client";
import { DeviceContext, type DeviceContextValue } from "./DeviceContext";
import { handshake } from "./handshake";
import type { Link } from "./link";
import { reconnectDelay } from "../lib/backoff";
import { canScanInApp, createBleLink } from "./links/bleLink";
import { createAndroidUsbLink } from "./links/androidUsbLink";
import { createCloudLink, type CloudLink } from "./links/cloudLink";
import { createMockLink } from "./links/mockLink";
import { createWebSerialLink } from "./links/webSerialLink";

type Snapshot = Pick<
  DeviceContextValue,
  "state" | "info" | "client" | "linkKind" | "baudRate" | "error" | "offline"
>;
type Active = { link: Link; client: DeviceClient; offClose: () => void };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Owns the one active connection: open → handshake → ready, and what happens when it drops. */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>({ state: "idle" });
  const active = useRef<Active | null>(null);
  const lastFactory = useRef<(() => Link) | null>(null);

  const teardown = useCallback(async () => {
    const current = active.current;
    active.current = null; // Before close(), so its onClose isn't treated as a drop.
    if (!current) return;
    current.offClose();
    current.client.dispose();
    await current.link.close().catch(() => {});
  }, []);

  const connect = useCallback(
    async (factory: () => Link, { reconnecting = false } = {}) => {
      await teardown();
      lastFactory.current = factory;
      const link = factory();
      setSnap((s) => ({
        state: "connecting",
        linkKind: link.kind,
        info: s.info,
      }));
      try {
        await link.open();
        const client = new DeviceClient(link);
        // The demo reuses one link across reconnects, so this handler must go when the connection does.
        const offClose = link.onClose((err) => {
          if (active.current?.link !== link) return; // We closed it on purpose.
          active.current = null;
          offClose();
          client.dispose();
          setSnap((s) => ({
            state: err ? "lost" : "idle",
            info: s.info,
            linkKind: link.kind,
            // The cloud says why (signed out, board removed); a radio just drops.
            error:
              err &&
              (link.kind === "cloud"
                ? err.message
                : "The connection to JoME was lost."),
          }));
        });
        // Through the server, the board can be offline while the link stays up (screens show the cloud copy).
        const cloud = link.kind === "cloud" ? (link as CloudLink) : undefined;
        const offline = () => {
          const p = cloud?.presence();
          return p && !p.online ? { syncedAt: p.syncedAt } : undefined;
        };
        cloud?.onPresence(() => {
          if (active.current?.link === link)
            setSnap((s) => ({ ...s, offline: offline() }));
        });
        active.current = { link, client, offClose };
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
        setSnap({
          state: "ready",
          info,
          client,
          linkKind: link.kind,
          baudRate: link.baudRate,
          offline: offline(),
        });
      } catch (e) {
        await teardown();
        await link.close().catch(() => {});
        setSnap((s) =>
          reconnecting
            ? {
                state: "lost",
                info: s.info,
                linkKind: link.kind,
                error: s.error,
              }
            : {
                state: "idle",
                linkKind: link.kind,
                error: `Couldn't connect to JoME. ${message(e)}`,
              },
        );
      }
    },
    [teardown],
  );

  // One demo board per session, like a real board that keeps its settings across
  // reconnects and restarts. Exit demo (forget) starts the next demo fresh.
  const demoLink = useRef<Link | null>(null);
  const connectDemo = useCallback(
    () => connect(() => (demoLink.current ??= createMockLink())),
    [connect],
  );
  const connectBle = useCallback(
    (deviceId: string) => connect(() => createBleLink(deviceId)),
    [connect],
  );
  const connectCloud = useCallback(
    (serial: string) => connect(() => createCloudLink(serial)),
    [connect],
  );

  // The open serial port, re-openable at another speed (terminal baud selector).
  const serial = useRef<((baudRate?: number) => Link) | null>(null);
  const connectSerial = useCallback(
    (make: (baudRate?: number) => Link, baudRate?: number) => {
      serial.current = make;
      return connect(() => make(baudRate));
    },
    [connect],
  );
  const connectWebSerial = useCallback(
    (port: SerialPort, baudRate?: number) =>
      connectSerial((b) => createWebSerialLink(port, b), baudRate),
    [connectSerial],
  );
  const setBaudRate = useCallback(
    async (baudRate: number) => {
      const make = serial.current;
      if (make && snap.linkKind === "usb") await connect(() => make(baudRate));
    },
    [connect, snap.linkKind],
  );

  const connectAndroidUsb = useCallback(
    (deviceId: number, baudRate?: number) =>
      connectSerial((b) => createAndroidUsbLink(deviceId, b), baudRate),
    [connectSerial],
  );

  // Bluetooth drops (out of range, board rebooted): keep trying with backoff while the app is visible.
  const attempts = useRef(0);
  useEffect(() => {
    if (snap.state === "ready") attempts.current = 0;
    const factory = lastFactory.current;
    if (snap.state !== "lost" || snap.linkKind !== "ble" || !factory) return;
    const timer = setTimeout(() => {
      // In the background: check again later without using up an attempt.
      if (document.hidden) return setSnap((s) => ({ ...s }));
      attempts.current += 1;
      void connect(factory, { reconnecting: true });
    }, reconnectDelay(attempts.current));
    return () => clearTimeout(timer);
  }, [snap, connect]);

  const retry = useCallback(async () => {
    if (lastFactory.current) await connect(lastFactory.current);
  }, [connect]);

  const rename = useCallback(
    async (name: string) => {
      const { client, info, linkKind } = snap;
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
      setSnap((s) => (s.info ? { ...s, info: { ...s.info, name } } : s));
    },
    [snap],
  );

  const restart = useCallback(async () => {
    const current = active.current;
    const factory = lastFactory.current;
    if (!current || !factory) throw new Error("Not connected");
    const kind = current.link.kind;
    await current.client.request("device.reboot", {});
    // Bluetooth reconnects on its own with backoff; other links need a nudge once the board has booted.
    if (kind === "ble") return;
    await new Promise((r) => setTimeout(r, 3000));
    await connect(factory, { reconnecting: true });
  }, [connect]);

  const disconnect = useCallback(
    async ({ forget = false } = {}) => {
      const serial = snap.info?.serial;
      await teardown();
      if (forget && snap.linkKind === "mock") demoLink.current = null;
      if (forget && serial) await forgetDevice(serial);
      setSnap({ state: "idle" });
    },
    [teardown, snap.info?.serial, snap.linkKind],
  );

  // Which link to open without being asked (docs/architecture.md, Choosing a link): the demo if
  // that's where they left off; the server for a board on the account; otherwise Bluetooth to the
  // last board, in native apps only (browsers need a tap first). Runs at launch and on sign-in.
  const auth = useAuth();
  const autoFor = useRef<AuthState>(undefined);
  useEffect(() => {
    if (auth.state === "loading" || autoFor.current === auth.state) return; // StrictMode runs effects twice.
    const launch = autoFor.current === undefined;
    autoFor.current = auth.state;
    if (auth.state === "signedOut" && !launch) {
      // The server needs the account, so signing out ends a connection through it.
      if (active.current?.link.kind === "cloud")
        void teardown().then(() => setSnap({ state: "idle" }));
      return;
    }
    if (active.current) return; // Already connected, e.g. nearby during setup.
    const before = lastFactory.current;
    void (async () => {
      const [last] = await getKnownDevices();
      const signedIn = auth.state === "signedIn";
      // The account's boards join this phone's list, so a new phone knows them too.
      const list = signedIn
        ? api<{ serial: string; name: string }[]>("/v1/devices").catch(() => [])
        : Promise.resolve([]);
      // Someone connected by hand meanwhile: leave theirs alone.
      if (lastFactory.current !== before) return;
      if (last?.lastLink === "mock") return void connectDemo();
      // Last time it was through the server: go straight there (opening checks it's still ours).
      // The list is merged after connecting, so the two writes to known devices don't race.
      if (signedIn && last?.lastLink === "cloud")
        return void connectCloud(last.serial)
          .then(() => list)
          .then(addKnownDevices);
      const boards = await list;
      await addKnownDevices(boards);
      if (lastFactory.current !== before) return;
      const board = last
        ? boards.find((b) => b.serial === last.serial)
        : boards[0];
      if (board) return void connectCloud(board.serial);
      if (launch && last?.bleDeviceId && canScanInApp())
        void connectBle(last.bleDeviceId);
    })();
  }, [auth.state, teardown, connectDemo, connectCloud, connectBle]);

  useEffect(() => () => void teardown(), [teardown]);

  const value = useMemo<DeviceContextValue>(
    () => ({
      ...snap,
      connectDemo,
      connectBle,
      connectWebSerial,
      connectAndroidUsb,
      setBaudRate,
      restart,
      rename,
      retry,
      disconnect,
    }),
    [
      snap,
      connectDemo,
      connectBle,
      connectWebSerial,
      connectAndroidUsb,
      setBaudRate,
      restart,
      rename,
      retry,
      disconnect,
    ],
  );
  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
