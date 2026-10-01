import { useEffect, useRef } from "react";
import { reconnectDelay } from "../lib/backoff";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAuthState, type AuthState } from "../store/authSlice";
import { autoConnect, retry, selectDevice } from "../store/deviceSlice";

/** Opens a connection without being asked, and brings Bluetooth back after a drop. Renders nothing. */
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

  return null;
}
