import { useEffect, useRef } from "react";
import { reconnectDelay } from "../lib/backoff";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAuthState, type AuthState } from "../store/authSlice";
import { autoConnect, retry, selectDevice } from "../store/deviceSlice";
import {
  programStep,
  readSensors,
  refreshGarden,
  refreshStatus,
  selectGarden,
  statusReceived,
  zoneState,
} from "../store/gardenSlice";
import { supports, useDeviceClient } from "./hooks";

/**
 * Opens a connection without being asked, brings Bluetooth back after a drop, and
 * keeps the one garden copy in the store current. Renders nothing.
 */
export function DeviceLifecycle() {
  const dispatch = useAppDispatch();
  const authState = useAppSelector(selectAuthState);
  const { state, linkKind } = useAppSelector(selectDevice);

  // At launch and on sign-in or sign-out (deviceSlice autoConnect).
  const autoFor = useRef<AuthState>(undefined);
  useEffect(() => {
    if (authState === "loading" || autoFor.current === authState) return; // StrictMode runs effects twice.
    const launch = autoFor.current === undefined;
    autoFor.current = authState;
    void dispatch(autoConnect(authState, { launch }));
  }, [authState, dispatch]);

  // Bluetooth drops (out of range, board rebooted): keep trying with backoff while the app is visible.
  const attempts = useRef(0);
  useEffect(() => {
    if (state === "ready") attempts.current = 0;
    if (state !== "lost" || linkKind !== "ble") return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        // In the background: check again later without using up an attempt.
        if (document.hidden) return wait();
        attempts.current += 1;
        void dispatch(retry({ reconnecting: true }));
      }, reconnectDelay(attempts.current));
    };
    wait();
    return () => clearTimeout(timer);
  }, [state, linkKind, dispatch]);

  useGardenSync();
  return null;
}

/** Load the garden on each new connection, follow board events, and read sensors. */
function useGardenSync() {
  const dispatch = useAppDispatch();
  const client = useDeviceClient();
  const { info, offline } = useAppSelector(selectDevice);

  // StrictMode re-runs effects: keep the three-request refresh from going to the board twice.
  const refreshedClient = useRef<typeof client>(undefined);
  useEffect(() => {
    if (!client) return;
    if (refreshedClient.current !== client) {
      refreshedClient.current = client;
      void dispatch(refreshGarden());
    }
    const offs = [
      client.on("status", (s) => dispatch(statusReceived(s))),
      client.on("zone.state", (e) => {
        dispatch(zoneState(e));
        // A run ended and the next may have moved on; ask once rather than guess.
        if (e.state !== "watering" || e.remaining === undefined)
          void dispatch(refreshStatus());
      }),
      client.on("program.state", (e) => dispatch(programStep(e))),
    ];
    return () => offs.forEach((off) => off());
  }, [client, dispatch]);

  // The board went offline or came back: the same reads now give the cloud copy, or the board's live state.
  const isOffline = offline !== undefined;
  const wasOffline = useRef(isOffline);
  useEffect(() => {
    if (wasOffline.current === isOffline) return;
    wasOffline.current = isOffline;
    void dispatch(refreshGarden());
  }, [isOffline, dispatch]);

  // Sensors: flow matters while watering (every 2 s), temperature changes slowly (every minute).
  const canSense = !!client && supports(info, "sensors.read");
  const watering = useAppSelector(selectGarden).run !== null;
  useEffect(() => {
    if (!canSense) return;
    void dispatch(readSensors());
    const id = setInterval(
      () => void dispatch(readSensors()),
      watering ? 2000 : 60_000,
    );
    return () => clearInterval(id);
  }, [canSense, watering, dispatch, client]);
}
