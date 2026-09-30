import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { forgetDevice, getKnownDevices, rememberDevice } from "../lib/storage";
import { DeviceClient } from "./client";
import { DeviceContext, type DeviceContextValue } from "./DeviceContext";
import { handshake } from "./handshake";
import type { Link } from "./link";
import { reconnectDelay } from "./backoff";
import { canScanInApp, createBleLink } from "./links/bleLink";
import { createAndroidUsbLink } from "./links/androidUsbLink";
import { createMockLink } from "./links/mockLink";
import { createWebSerialLink } from "./links/webSerialLink";

type Snapshot = Pick<
  DeviceContextValue,
  "state" | "info" | "client" | "linkKind" | "baudRate" | "error"
>;
type Active = { link: Link; client: DeviceClient };

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
        active.current = { link, client };
        link.onClose((err) => {
          if (active.current?.link !== link) return; // We closed it on purpose.
          active.current = null;
          client.dispose();
          setSnap((s) => ({
            state: err ? "lost" : "idle",
            info: s.info,
            linkKind: link.kind,
            error: err && "The connection to JoME was lost.",
          }));
        });
        const info = await handshake(client);
        await rememberDevice({
          serial: info.serial,
          name: info.name,
          lastLink: link.kind,
          bleDeviceId: link.kind === "ble" ? link.peerId : undefined,
          lastSeen: Date.now(),
        });
        setSnap({
          state: "ready",
          info,
          client,
          linkKind: link.kind,
          baudRate: link.baudRate,
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

  const connectDemo = useCallback(() => connect(createMockLink), [connect]);
  const connectBle = useCallback(
    (deviceId: string) => connect(() => createBleLink(deviceId)),
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

  const disconnect = useCallback(
    async ({ forget = false } = {}) => {
      const serial = snap.info?.serial;
      await teardown();
      if (forget && serial) await forgetDevice(serial);
      setSnap({ state: "idle" });
    },
    [teardown, snap.info?.serial],
  );

  // Returning user: reconnect to the last device (USB reconnect arrives with #13).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development.
    started.current = true;
    getKnownDevices().then(([last]) => {
      if (last?.lastLink === "mock") void connectDemo();
      // Browsers need a user gesture before connecting, so only native apps reconnect on launch.
      else if (last?.lastLink === "ble" && last.bleDeviceId && canScanInApp())
        void connectBle(last.bleDeviceId);
    });
  }, [connectDemo, connectBle]);

  useEffect(() => () => void teardown(), [teardown]);

  const value = useMemo<DeviceContextValue>(
    () => ({
      ...snap,
      connectDemo,
      connectBle,
      connectWebSerial,
      connectAndroidUsb,
      setBaudRate,
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
      rename,
      retry,
      disconnect,
    ],
  );
  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
