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
import { createMockLink } from "./links/mockLink";

type Snapshot = Pick<
  DeviceContextValue,
  "state" | "info" | "client" | "linkKind" | "error"
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
    async (factory: () => Link) => {
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
          lastSeen: Date.now(),
        });
        setSnap({ state: "ready", info, client, linkKind: link.kind });
      } catch (e) {
        await teardown();
        await link.close().catch(() => {});
        setSnap({
          state: "idle",
          linkKind: link.kind,
          error: `Couldn't connect to JoME. ${message(e)}`,
        });
      }
    },
    [teardown],
  );

  const connectDemo = useCallback(() => connect(createMockLink), [connect]);

  const retry = useCallback(async () => {
    if (lastFactory.current) await connect(lastFactory.current);
  }, [connect]);

  const disconnect = useCallback(
    async ({ forget = false } = {}) => {
      const serial = snap.info?.serial;
      await teardown();
      if (forget && serial) await forgetDevice(serial);
      setSnap({ state: "idle" });
    },
    [teardown, snap.info?.serial],
  );

  // Returning user: reconnect to the last device. Only the demo can reconnect until BLE/USB land (#11, #13).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development.
    started.current = true;
    getKnownDevices().then(([last]) => {
      if (last?.lastLink === "mock") void connectDemo();
    });
  }, [connectDemo]);

  useEffect(() => () => void teardown(), [teardown]);

  const value = useMemo<DeviceContextValue>(
    () => ({ ...snap, connectDemo, retry, disconnect }),
    [snap, connectDemo, retry, disconnect],
  );
  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}
